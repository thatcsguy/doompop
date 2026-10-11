"""Shared paths and helpers for the analysis scripts."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def song_dir(slug: str) -> Path:
    d = ROOT / "songs" / slug
    if not (d / "audio" / "song.wav").exists():
        sys.exit(f"songs/{slug}/audio/song.wav not found. Add the song first: node tools/new-song.mjs {slug} <file>")
    return d


def stems_dir(slug: str) -> Path:
    return ROOT / "analysis" / "stems" / slug


def overrides(slug: str) -> dict:
    """songs/<slug>/analysis.json holds manual fixes that survive re-runs (see analysis/README.md)."""
    p = song_dir(slug) / "analysis.json"
    return json.loads(p.read_text()) if p.exists() else {}


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=1))
    tmp.replace(path)


def r3(x) -> float:
    return round(float(x), 3)
