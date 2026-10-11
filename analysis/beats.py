"""Measure the song's timing: beats, bars, sections, drum hits, impacts and loudness envelopes.

    uv run python beats.py <slug>

Writes songs/<slug>/data/audio.json. Uses the drum stem if stems.py has run, otherwise the
percussive part of the mix. Manual fixes go in songs/<slug>/analysis.json (see README.md):
  "bpm_range": [lo, hi]      pin the tempo octave (fixes half/double time)
  "downbeat_phase": 0..3     which beat of the first four is beat 1
  "sections": [{"id", "start", "end"}, ...]   replace the detected sections
  "impacts_add": [t, ...], "impacts_drop": [t, ...]
"""
import argparse

import librosa
import numpy as np
import scipy.ndimage as ndi
import soundfile as sf

from common import overrides, r3, song_dir, stems_dir, write_json

np.seterr(invalid="ignore", divide="ignore")
SR = 22050
HOP = 256  # ~11.6 ms
ENV_FPS = 60

ap = argparse.ArgumentParser()
ap.add_argument("slug")
a = ap.parse_args()
d = song_dir(a.slug)
ov = overrides(a.slug)
stems = stems_dir(a.slug)


def load(path):
    y, sr = sf.read(str(path), always_2d=True)
    y = y.mean(axis=1)
    return librosa.resample(y, orig_sr=sr, target_sr=SR) if sr != SR else y


mix = load(d / "audio" / "song.wav")
duration = len(mix) / SR
have_stems = (stems / "drums.wav").exists()
drums = load(stems / "drums.wav") if have_stems else librosa.effects.percussive(mix, margin=3.0)
vocals = load(stems / "vocals.wav") if (stems / "vocals.wav").exists() else None
print(f"{duration:.2f} s, drum source: {'stem' if have_stems else 'HPSS of the mix (run stems.py for better hits)'}")

# ---- beats -------------------------------------------------------------------------------
onset = librosa.onset.onset_strength(y=drums, sr=SR, hop_length=HOP, aggregate=np.median)
lo, hi = ov.get("bpm_range", [78, 180])
tempo0 = float(np.atleast_1d(librosa.feature.tempo(onset_envelope=onset, sr=SR, hop_length=HOP, start_bpm=120))[0])
while tempo0 < lo:
    tempo0 *= 2
while tempo0 >= hi:
    tempo0 /= 2
_, beat_frames = librosa.beat.beat_track(onset_envelope=onset, sr=SR, hop_length=HOP, start_bpm=tempo0, tightness=300, trim=False)
beats = librosa.frames_to_time(beat_frames, sr=SR, hop_length=HOP)

bpm = 60.0 / float(np.median(np.diff(beats)))
print(f"tempo {bpm:.2f} BPM, {len(beats)} beats")

# ---- drum hits: zero-phase band filters, so onset times aren't shifted by an analysis window ----
from scipy.signal import butter, sosfiltfilt

FINE = 64  # ~2.9 ms


def band_flux(y, f0, f1, smooth=0.004):
    sos = butter(4, [f0, min(f1, SR / 2 - 100)], btype="bandpass", fs=SR, output="sos")
    e = np.abs(sosfiltfilt(sos, y))
    e = ndi.uniform_filter1d(e, int(smooth * SR))[::FINE]
    e = np.log1p(e / (np.percentile(e, 99.5) + 1e-9) * 20)
    flux = np.maximum(0, np.diff(e, prepend=e[0]))
    flux = ndi.gaussian_filter1d(flux, 1.0)
    return flux / (np.percentile(flux, 99.9) + 1e-9)


def onsets(flux, thresh, min_gap=0.07):
    w = int(0.05 * SR / FINE)
    pk = librosa.util.peak_pick(flux, pre_max=w, post_max=w, pre_avg=4 * w, post_avg=w, delta=thresh, wait=int(min_gap * SR / FINE))
    return pk * FINE / SR, flux[pk]


# a 4 ms envelope follows the individual cycles of a 50-100 Hz kick, so one kick peak-picked as 2-4
# onsets; 40 ms smooths over the cycles while keeping 16th-note kicks apart
kick_flux = band_flux(drums, 30, 150, smooth=0.04)
kicks, kick_s = onsets(kick_flux, 0.3)
# snare wires (1-5 kHz) separate snares from kick clicks and hats better than the snare body does;
# keep only strong onsets, since hats leak into this band at lower strength
snares_raw, snare_s = onsets(band_flux(drums, 1000, 5000), 0.15)
snares = snares_raw[snare_s >= 0.6]
hats, _ = onsets(band_flux(drums, 6000, 11000), 0.12, 0.05)

# snap beats to a kick or snare within +-35 ms when there is one (the tracker's grid is coarse)
hits_all = np.sort(np.r_[kicks, snares])
if len(hits_all):
    beats = np.array([hits_all[np.argmin(np.abs(hits_all - b))] if np.min(np.abs(hits_all - b)) < 0.035 else b for b in beats])
    beats = np.maximum.accumulate(beats)
kick_env = np.interp(librosa.frames_to_time(np.arange(len(onset)), sr=SR, hop_length=HOP), np.arange(len(kick_flux)) * FINE / SR, kick_flux)

# ---- downbeats: which of the four beat phases is beat 1 ------------------------------------
chroma = librosa.feature.chroma_cqt(y=librosa.effects.harmonic(mix), sr=SR, hop_length=HOP)
chroma_change = np.r_[0, np.linalg.norm(np.diff(chroma, axis=1), axis=0)]
bf = librosa.time_to_frames(beats, sr=SR, hop_length=HOP).clip(0, len(kick_env) - 1)
scores = []
for p in range(4):
    idx = bf[p::4]
    scores.append(kick_env[idx].mean() + 2.0 * chroma_change[idx.clip(0, len(chroma_change) - 1)].mean() / (chroma_change.mean() + 1e-9) * 0.25)
phase = int(ov.get("downbeat_phase", int(np.argmax(scores))))
downbeats = beats[phase::4]
print(f"downbeat phase {phase} (scores {', '.join(f'{s:.2f}' for s in scores)})" + (" [override]" if "downbeat_phase" in ov else ""))

# ---- envelopes at 60 fps -------------------------------------------------------------------
Smix = np.abs(librosa.stft(mix, n_fft=2048, hop_length=HOP))
freqs = librosa.fft_frequencies(sr=SR, n_fft=2048)
times = librosa.frames_to_time(np.arange(Smix.shape[1]), sr=SR, hop_length=HOP)
grid = np.arange(0, duration, 1 / ENV_FPS)


def env_of(x):
    x = ndi.gaussian_filter1d(x, 1.5)
    x = x / (np.percentile(x, 98) + 1e-9)
    return [round(float(v), 3) for v in np.clip(np.interp(grid, times, x), 0, 1)]


def band_energy(f0, f1):
    sel = (freqs >= f0) & (freqs < f1)
    return np.sqrt((Smix[sel] ** 2).mean(axis=0))


rms = librosa.feature.rms(y=mix, frame_length=2048, hop_length=HOP)[0]
envelopes = {"fps": ENV_FPS, "rms": env_of(rms), "low": env_of(band_energy(20, 150)), "mid": env_of(band_energy(150, 2000)), "high": env_of(band_energy(4000, 11000))}
if vocals is not None:
    envelopes["vocal"] = env_of(librosa.feature.rms(y=vocals, frame_length=2048, hop_length=HOP)[0])

# ---- impacts: loud arrivals (drops, chorus hits) --------------------------------------------
rms_t = librosa.frames_to_time(np.arange(len(rms)), sr=SR, hop_length=HOP)
impacts = []
for i, t in enumerate(rms_t):
    pre = rms[(rms_t >= t - 1.5) & (rms_t < t)]
    post = rms[(rms_t >= t) & (rms_t < t + 0.6)]
    if len(pre) < 10 or len(post) < 5:
        continue
    score = (post.mean() - pre.mean()) / (rms.max() + 1e-9)
    if score >= 0.12:
        impacts.append((t, score))
merged = []
for t, s in impacts:  # keep the best within 2 s
    if merged and t - merged[-1][0] < 2.0:
        if s > merged[-1][1]:
            merged[-1] = (t, s)
    else:
        merged.append((t, s))
imp = []
for t, s in merged:
    if len(downbeats):
        k = int(np.argmin(np.abs(downbeats - t)))
        if abs(downbeats[k] - t) < 0.65:
            t = downbeats[k]
    imp.append({"t": r3(t), "strength": r3(min(1.0, s / 0.35))})
for t in ov.get("impacts_add", []):
    imp.append({"t": r3(t), "strength": 1.0})
imp = sorted([x for x in imp if not any(abs(x["t"] - t) < 0.3 for t in ov.get("impacts_drop", []))], key=lambda x: x["t"])

# ---- sections: structural segmentation snapped to bars --------------------------------------
if "sections" in ov:
    sections = ov["sections"]
else:
    mfcc = librosa.feature.mfcc(y=mix, sr=SR, hop_length=HOP, n_mfcc=13)
    feat = np.vstack([librosa.util.normalize(chroma, axis=0), librosa.util.normalize(mfcc, axis=1)])
    bar_frames = librosa.time_to_frames(downbeats, sr=SR, hop_length=HOP)
    sync = librosa.util.sync(feat, bar_frames, aggregate=np.median)
    k = int(np.clip(round(duration / 22), 3, 14))
    bounds = librosa.segment.agglomerative(sync, k)
    starts = [0.0] + [float(downbeats[min(b - 1, len(downbeats) - 1)]) for b in bounds[1:] if b > 0]
    starts = sorted(set(round(s, 3) for s in starts))
    ends = starts[1:] + [duration]
    # letter sections by similarity of their mean features (A, B, A, C ...)
    means = []
    for s, e in zip(starts, ends):
        m = (times >= s) & (times < e)
        means.append(feat[:, m[: feat.shape[1]]].mean(axis=1) if m[: feat.shape[1]].any() else np.zeros(feat.shape[0]))
    letters, protos = [], []
    for m in means:
        for j, p in enumerate(protos):
            if np.corrcoef(m, p)[0, 1] > 0.9:
                letters.append(chr(65 + j))
                break
        else:
            protos.append(m)
            letters.append(chr(65 + len(protos) - 1))
    sections = []
    for i, (s, e, L) in enumerate(zip(starts, ends, letters)):
        m = (rms_t >= s) & (rms_t < e)
        energy = int(round(9 * rms[m].mean() / rms.max())) if m.any() else 0
        sections.append({"id": f"s{i + 1:02d}", "label": f"{L} (energy {energy})", "start": r3(s), "end": r3(e)})

data = {
    "duration": r3(duration),
    "bpm": round(bpm, 3),
    "note": "beats are measured (tempo can drift); downbeats are every 4th beat from the chosen phase",
    "beats": [r3(t) for t in beats],
    "downbeats": [r3(t) for t in downbeats],
    "sections": sections,
    "hits": {"kick": [r3(t) for t in kicks], "snare": [r3(t) for t in snares], "hat": [r3(t) for t in hats], "impact": imp},
    "envelopes": envelopes,
}
write_json(d / "data" / "audio.json", data)
print(f"{len(downbeats)} bars, {len(sections)} sections, {len(kicks)} kicks, {len(snares)} snares, {len(hats)} hats, {len(imp)} impacts")
print(f"-> songs/{a.slug}/data/audio.json")
