"""Time every sung word: forced alignment of the lyric sheet, cross-checked by what Whisper hears.

    uv run python lyrics.py <slug> [--whisper large-v3-turbo] [--no-whisper]

Reads songs/<slug>/lyrics.txt (one sung line per line; [Section] markers and # comments allowed)
and the vocal stem (run stems.py first; falls back to the mix, which is much worse).
Writes songs/<slug>/data/lyrics.json and songs/<slug>/data/lyrics-review.md (words to check by ear).

Method:
  1. CTC forced alignment (torchaudio MMS_FA) of the sheet against the vocal stem -> word times + confidence.
  2. faster-whisper transcribes the vocal with word timestamps -> what was actually sung.
  3. Per word: keep the CTC time when confident; otherwise take Whisper's when it heard the same word.
  4. Word ends are extended over held notes using vocal energy.
  5. Fixes in songs/<slug>/analysis.json "word_fixes": [{"line": i, "word": j, "start": t, "end": t}] are applied last.
Model weights download on first run (download.pytorch.org for MMS_FA, huggingface.co for Whisper).
"""
import argparse
import difflib
import re

import numpy as np
import soundfile as sf
import torch
import torchaudio

from common import overrides, r3, song_dir, stems_dir, write_json

ap = argparse.ArgumentParser()
ap.add_argument("slug")
ap.add_argument("--whisper", default="large-v3-turbo", help="faster-whisper model name")
ap.add_argument("--no-whisper", action="store_true")
a = ap.parse_args()
d = song_dir(a.slug)
ov = overrides(a.slug)

# ---- the sheet ------------------------------------------------------------------------------
ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def num_words(n: int) -> str:
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + ("" if n % 10 == 0 else " " + ONES[n % 10])
    if n < 1000:
        return ONES[n // 100] + " hundred" + ("" if n % 100 == 0 else " " + num_words(n % 100))
    return " ".join(ONES[int(c)] for c in str(n))


def norm(word: str) -> str:
    w = word.lower().replace("’", "'")
    w = re.sub(r"\d+", lambda m: num_words(int(m.group())), w)
    return re.sub(r"[^a-z' ]", "", w).strip()


lines, section = [], None
for raw in (d / "lyrics.txt").read_text().splitlines():
    s = raw.strip()
    if not s or s.startswith("#"):
        continue
    m = re.fullmatch(r"\[(.+?)\]", s)
    if m:  # [Verse 1 — mood] starts a section; other bracketed lines ([quiet, trembling]) are delivery notes
        name = re.split(r"\s+[—–-]\s+", m.group(1))[0].strip()
        if re.match(r"(?i)(intro|verse|pre-?chorus|chorus|post-?chorus|bridge|hook|refrain|interlude|break|drop|outro|final)", name):
            section = name
        continue
    s = re.sub(r"\(.*?\)", "", s).strip() or s  # parenthesised backing vocals are usually not in the lead stem
    toks = [t for t in s.split() if norm(t)]
    words = []
    for t in toks:
        disp = re.sub(r"^[^\w']+|[^\w'!?]+$", "", t) or t
        for part in norm(t).split():  # "42" -> "forty two": several aligned words, shown once
            words.append({"w": disp, "n": part})
    if words:
        lines.append({"text": s, "section": section, "words": words})
if not lines:
    raise SystemExit("lyrics.txt has no lyric lines")
flat = [w for l in lines for w in l["words"]]
print(f"{len(lines)} lines, {len(flat)} words")

# ---- audio ----------------------------------------------------------------------------------
vpath = stems_dir(a.slug) / "vocals.wav"
src = vpath if vpath.exists() else d / "audio" / "song.wav"
if not vpath.exists():
    print("WARNING: no vocal stem, aligning against the full mix. Run stems.py first.")
y, sr = sf.read(str(src), always_2d=True)
y = torch.tensor(y.mean(axis=1), dtype=torch.float32)
y16 = torchaudio.functional.resample(y, sr, 16000)
duration = len(y) / sr

# ---- 1. CTC forced alignment ----------------------------------------------------------------
bundle = torchaudio.pipelines.MMS_FA
model = bundle.get_model(with_star=False).eval()
labels = bundle.get_dict(star=None)
CHUNK, CTX = 16000 * 20, 16000 * 2
ems = []
with torch.inference_mode():
    for start in range(0, len(y16), CHUNK):
        a0, a1 = max(0, start - CTX), min(len(y16), start + CHUNK + CTX)
        em, _ = model(y16[a0:a1].unsqueeze(0))
        fps_em = em.shape[1] / ((a1 - a0) / 16000)
        lo = int(round((start - a0) / 16000 * fps_em))
        hi = lo + int(round(min(CHUNK, len(y16) - start) / 16000 * fps_em))
        ems.append(em[0, lo:hi])
emission = torch.log_softmax(torch.cat(ems), dim=-1)
frame_dt = duration / emission.shape[0]

tokens, owner = [], []
for i, w in enumerate(flat):
    for ch in w["n"].replace(" ", ""):
        if ch in labels:
            tokens.append(labels[ch])
            owner.append(i)
ali, scores = torchaudio.functional.forced_align(emission.unsqueeze(0), torch.tensor([tokens], dtype=torch.int32), blank=0)
ali, scores = ali[0].numpy(), scores[0].exp().numpy()
# walk the frame path: each non-blank run that starts a new token belongs to owner[token_index]
ctc = [{"start": None, "end": None, "p": []} for _ in flat]
ti, prev = -1, 0
for f, (tok, p) in enumerate(zip(ali, scores)):
    if tok != 0 and (tok != prev or prev == 0):
        ti += 1
    if tok != 0 and 0 <= ti < len(owner):
        c = ctc[owner[ti]]
        c["start"] = f * frame_dt if c["start"] is None else c["start"]
        c["end"] = (f + 1) * frame_dt
        c["p"].append(float(p))
    prev = tok
for c in ctc:
    c["conf"] = float(np.mean(c["p"])) if c["p"] else 0.0

# ---- 2. Whisper: what was actually sung -----------------------------------------------------
heard = []
if not a.no_whisper:
    from faster_whisper import WhisperModel

    wm = WhisperModel(a.whisper, device="cuda" if torch.cuda.is_available() else "cpu", compute_type="float16" if torch.cuda.is_available() else "int8")
    prompt = " ".join(l["text"] for l in lines)[:600]
    segs, _ = wm.transcribe(y16.numpy(), language="en", word_timestamps=True, initial_prompt=prompt, condition_on_previous_text=False, vad_filter=False, beam_size=5)
    for seg in segs:
        for w in seg.words or []:
            for part in norm(w.word).split():
                heard.append({"n": part, "start": float(w.start), "end": float(w.end), "p": float(w.probability)})
    print(f"whisper heard {len(heard)} words")

match = {}
sm = difflib.SequenceMatcher(a=[w["n"] for w in flat], b=[h["n"] for h in heard], autojunk=False)
for blk in sm.get_matching_blocks():
    for k in range(blk.size):
        match[blk.a + k] = heard[blk.b + k]
extra_heard = []
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag in ("insert", "replace") and j2 > j1:
        extra_heard.append((heard[j1]["start"], " ".join(h["n"] for h in heard[j1:j2]), " ".join(w["n"] for w in flat[i1:i2])))

# ---- 3. merge -------------------------------------------------------------------------------
out_words, flags = [], []
for i, (w, c) in enumerate(zip(flat, ctc)):
    h = match.get(i)
    if c["start"] is not None and c["conf"] >= 0.5:
        s, e, srcname, conf = c["start"], c["end"], "ctc", c["conf"]
    elif h is not None:
        s, e, srcname, conf = h["start"], h["end"], "whisper", h["p"] * 0.8
    elif c["start"] is not None:
        s, e, srcname, conf = c["start"], c["end"], "ctc-low", c["conf"]
    else:
        s, e, srcname, conf = None, None, "missing", 0.0
    out_words.append({"w": w["w"], "n": w["n"], "start": s, "end": e, "conf": conf, "src": srcname})
    why = []
    if conf < 0.25:
        why.append(f"low confidence {conf:.2f}")
    if h is not None and c["start"] is not None and abs(h["start"] - c["start"]) > 0.3:
        why.append(f"aligner {c['start']:.2f}s vs whisper {h['start']:.2f}s")
    if s is None:
        why.append("not placed")
    if why:
        flags.append((i, why))

# fill unplaced words by interpolating between neighbours
for i, w in enumerate(out_words):
    if w["start"] is None:
        prev_e = next((out_words[j]["end"] for j in range(i - 1, -1, -1) if out_words[j]["end"] is not None), 0.0)
        nxt_s = next((out_words[j]["start"] for j in range(i + 1, len(out_words)) if out_words[j]["start"] is not None), prev_e + 0.4)
        w["start"], w["end"] = prev_e, max(prev_e + 0.05, min(nxt_s, prev_e + 0.4))

# ---- 4. extend ends over held notes ---------------------------------------------------------
hop = 160
venv = np.sqrt(np.convolve(y16.numpy() ** 2, np.ones(hop * 2) / (hop * 2), mode="same")[::hop])
vt = np.arange(len(venv)) * hop / 16000
for i, w in enumerate(out_words):
    nxt = out_words[i + 1]["start"] if i + 1 < len(out_words) else duration
    m = (vt >= w["start"]) & (vt < w["end"])
    peak = venv[m].max() if m.any() else 0
    e = w["end"]
    while e + 0.02 < min(nxt - 0.03, w["start"] + 4.0):
        k = int(e * 100)
        if k >= len(venv) or venv[k] < 0.35 * peak:
            break
        e += 0.01
    w["end"] = max(w["end"], e)

# ---- 5. manual fixes, then assemble lines ---------------------------------------------------
k = 0
for li, l in enumerate(lines):
    for wi, _ in enumerate(l["words"]):
        out_words[k]["line"], out_words[k]["idx"] = li, wi
        k += 1
for fx in ov.get("word_fixes", []):
    for w in out_words:
        if w["line"] == fx["line"] and w["idx"] == fx["word"]:
            w["start"] = fx.get("start", w["start"])
            w["end"] = fx.get("end", w["end"])
            w["src"] = "manual"

data_lines = []
for li, l in enumerate(lines):
    ws = [w for w in out_words if w["line"] == li]
    merged = []  # words that were split for alignment ("forty two") show as one display word
    for w in ws:
        if merged and merged[-1]["w"] == w["w"] and merged[-1]["_split"]:
            merged[-1]["end"] = w["end"]
            continue
        merged.append({"w": w["w"], "start": w["start"], "end": w["end"], "conf": w["conf"], "src": w["src"], "_split": len(norm(w["w"]).split()) > 1})
    for m in merged:
        m.pop("_split")
        m["start"], m["end"], m["conf"] = r3(m["start"]), r3(m["end"]), round(m["conf"], 2)
    data_lines.append({"text": l["text"], "section": l["section"], "start": merged[0]["start"], "end": merged[-1]["end"], "words": merged})

write_json(d / "data" / "lyrics.json", {"meta": {"method": "MMS_FA CTC forced alignment of the vocal stem, cross-checked with faster-whisper " + a.whisper, "source": src.name}, "lines": data_lines})

# ---- review list ----------------------------------------------------------------------------
rev = [f"# Lyric timing review: {a.slug}", "", f"{len(flat)} words, {len(flags)} flagged. Check these by ear (scrub the preview to the time).", ""]
for i, why in flags:
    w = out_words[i]
    rev.append(f"- {w['start']:.2f}s  line {w['line'] + 1}: **{w['w']}**  ({'; '.join(why)})")
if extra_heard:
    rev += ["", "## Heard differently from the sheet", "", "Whisper heard these where the sheet says otherwise. Fix lyrics.txt if the take really sings it.", ""]
    rev += [f"- {t:.2f}s  heard \"{hw}\"  sheet \"{sw}\"" for t, hw, sw in extra_heard]
(d / "data" / "lyrics-review.md").write_text("\n".join(rev) + "\n")
print(f"{len(flags)} words flagged -> songs/{a.slug}/data/lyrics-review.md")
print(f"-> songs/{a.slug}/data/lyrics.json")
