"""Split the song into vocals / drums / bass / other with Demucs.

    uv run python stems.py <slug> [--ft]

--ft uses htdemucs_ft (better, ~4x slower). Output: analysis/stems/<slug>/{vocals,drums,bass,other}.wav
Needs the Demucs weights (downloaded from dl.fbaipublicfiles.com on first run).
"""
import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from common import song_dir, stems_dir

ap = argparse.ArgumentParser()
ap.add_argument("slug")
ap.add_argument("--ft", action="store_true")
a = ap.parse_args()

wav = song_dir(a.slug) / "audio" / "song.wav"
model = "htdemucs_ft" if a.ft else "htdemucs"
out = stems_dir(a.slug)
with tempfile.TemporaryDirectory() as tmp:
    import torch
    dev = "cuda" if torch.cuda.is_available() else ("mps" if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available() else "cpu")
    subprocess.run([sys.executable, "-m", "demucs", "-n", model, "-d", dev, "-o", tmp, str(wav)], check=True)
    src = Path(tmp) / model / wav.stem
    out.mkdir(parents=True, exist_ok=True)
    for stem in ("vocals", "drums", "bass", "other"):
        shutil.move(str(src / f"{stem}.wav"), out / f"{stem}.wav")
print(f"stems -> {out}")
