# analysis/

Python tools that measure a song so shots can sync to it. Run them through `npm run analyze -- <slug>`
(needs [uv](https://docs.astral.sh/uv/); it installs everything into `analysis/.venv` on first run).

| Step | Script | Writes |
|---|---|---|
| stems | `stems.py` (Demucs) | `analysis/stems/<slug>/{vocals,drums,bass,other}.wav` (gitignored) |
| beats | `beats.py` (librosa) | `songs/<slug>/data/audio.json` |
| lyrics | `lyrics.py` (MMS_FA forced alignment + faster-whisper) | `songs/<slug>/data/lyrics.json`, `lyrics-review.md` |

First runs download model weights from `dl.fbaipublicfiles.com` (Demucs), `download.pytorch.org` (MMS_FA)
and `huggingface.co` (Whisper). `beats` needs no downloads and works without stems (it falls back to the
percussive part of the mix), but hits are cleaner with the drum stem.

## Data shapes

`audio.json`: `duration`, `bpm`, `beats[]` and `downbeats[]` (seconds, measured, so tempo drift is real),
`sections[] {id, label, start, end}`, `hits {kick[], snare[], hat[], impact[{t, strength}]}`,
`envelopes {fps: 60, rms[], low[], mid[], high[], vocal[]}` (0..1).

`lyrics.json`: `lines[] {text, section, start, end, words[] {w, start, end, conf, src}}`.
`src` says where a time came from: `ctc` (aligner, confident), `whisper`, `ctc-low`, `manual`.

## Manual fixes

Put corrections in `songs/<slug>/analysis.json` so they survive re-runs:

```json
{
  "bpm_range": [80, 160],
  "downbeat_phase": 1,
  "sections": [{ "id": "verse1", "start": 12.3, "end": 40.1 }],
  "impacts_add": [61.2],
  "impacts_drop": [33.0],
  "word_fixes": [{ "line": 4, "word": 2, "start": 41.22 }]
}
```

Rules: fix `lyrics.txt` if the take sings something else; fix times if it sings the sheet. Never edit the audio.
