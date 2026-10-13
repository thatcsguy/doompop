// Manual word-time fixes from analysis.json, applied on top of data/lyrics.json at load.
// analysis/lyrics.py applies the same fixes when it runs, so data/lyrics.json never needs a hand
// edit and a fix takes effect without re-running the whole alignment. A fix's `word` counts
// aligned words; that is the display word index for any line without numbers in it.
import type { LyricsData } from '../../engine/song';

export interface WordFix { line: number; word: number; start?: number; end?: number }

export function withWordFixes(data: LyricsData, fixes: WordFix[] = []): LyricsData {
  const lines = data.lines.map(l => ({ ...l, words: l.words.map(w => ({ ...w })) }));
  for (const fx of fixes) {
    const line = lines[fx.line], w = line?.words[fx.word];
    if (!w) throw new Error(`analysis.json word fix: no word ${fx.word} on line ${fx.line}`);
    w.start = fx.start ?? w.start;
    w.end = fx.end ?? w.end;
  }
  for (const l of lines) { l.start = l.words[0].start; l.end = l.words[l.words.length - 1].end; }
  return { ...data, lines };
}
