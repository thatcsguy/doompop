// Lyric layouts for "The Smoking Gun", one entry per line (1-based, as in data/lyrics.json),
// placed in each shot's empty space. Debugging lines type out like a terminal; disco lines are
// neon. Word keys are 0-based. See lyrics-disco.ts for the looks.
import type { DiscoSpec } from './lyrics-disco';
import { PAL, SIGN_FONT } from './look';

const TERM = { style: 'term', size: 62, anim: 'type', color: PAL.green, exit: 'scroll', hold: 0.35, tilt: 0 } as const;

export const DISCO_LYRICS: DiscoSpec = {
  base: { style: 'neon', size: 100, y: 0.15, anim: 'flicker', exit: 'flicker' },
  lines: {
    // verse 1
    1: { ...TERM, x: 0.05, y: 0.1, align: 'left', maxWidth: 0.6, words: { 4: { color: '#d8ffe6' } } },
    2: { ...TERM, x: 0.05, y: 0.1, align: 'left', maxWidth: 0.7, words: { 3: { color: PAL.red, scale: 1.25 } } },
    3: { ...TERM, x: 0.05, y: 0.1, align: 'left', maxWidth: 0.7, words: { 5: { color: PAL.cyan } } },
    4: { x: 0.5, y: 0.13, color: PAL.cyan, maxWidth: 0.8, words: { 3: { scale: 1.2 } } },
    5: { x: 0.06, y: 0.14, align: 'left', color: PAL.pink, maxWidth: 0.56, size: 92, words: { 2: { color: PAL.gold, scale: 1.15 }, 4: { font: SIGN_FONT, scale: 1.25, color: PAL.gold } } },
    6: { x: 0.5, y: 0.13, color: PAL.violetNeon, words: { 1: { color: PAL.cyan }, 4: { anim: 'stamp', color: PAL.red, scale: 1.3, core: 0.3 } } },
    7: { x: 0.5, y: 0.14, color: PAL.gold, words: { 2: { scale: 1.2 } } },
    8: { x: 0.5, y: 0.13, color: PAL.violetNeon, words: { 4: { shake: 0.5 }, 5: { shake: 1, scale: 1.25 } } },
    9: { ...TERM, x: 0.05, y: 0.1, align: 'left', maxWidth: 0.7, words: { 4: { color: '#c38bff' } } },
    10: { ...TERM, x: 0.95, y: 0.88, align: 'right', maxWidth: 0.6, words: { 3: { color: PAL.red }, 4: { color: PAL.red } } },
    11: { x: 0.5, y: 0.13, color: PAL.pink, size: 96, maxWidth: 0.92, words: { 1: { scale: 1.1 }, 4: { anim: 'stamp', color: PAL.gold, scale: 1.35 } } },
    12: { x: 0.5, y: 0.13, color: PAL.cyan, words: { 4: { anim: 'stamp', color: PAL.red, scale: 1.7, core: 0.3 } } },
    13: { x: 0.5, y: 0.13, color: PAL.gold, words: { 1: { anim: 'stamp', scale: 1.2 } } },
    14: { x: 0.5, y: 0.13, color: PAL.pink, words: { 3: { anim: 'stamp', scale: 1.4, color: PAL.gold } } },
    15: { x: 0.5, y: 0.13, color: PAL.cyan, words: { 1: { anim: 'stamp', scale: 1.5, color: PAL.gold } } },
    16: { x: 0.5, y: 0.13, color: PAL.violetNeon, hold: 0.2, words: { 4: { shake: 1, scale: 1.4, color: PAL.red, core: 0.3 } } },
    // chorus 1: big neon, each line's key word stamped in the colour of its evidence
    17: { x: 0.5, y: 0.13, color: PAL.cyan, words: { 1: { color: PAL.green }, 3: { anim: 'slide' }, 4: { anim: 'slide' }, 5: { anim: 'stamp', color: PAL.gold, scale: 1.25 } } },
    18: { x: 0.5, y: 0.1, size: 90, maxWidth: 0.92, color: PAL.pink, words: { 1: { color: PAL.cyan, scale: 1.1 }, 4: { anim: 'stamp', color: PAL.gold, scale: 1.3 } } },
    19: { x: 0.5, y: 0.12, size: 90, maxWidth: 0.92, color: PAL.violetNeon, words: { 1: { color: PAL.gold, scale: 1.15 }, 4: { anim: 'stamp', color: PAL.red, scale: 1.4, core: 0.3 } } },
    20: { x: 0.05, y: 0.6, align: 'left', size: 92, maxWidth: 0.42, color: PAL.pink, words: { 1: { color: PAL.cyan }, 3: { anim: 'stamp', color: PAL.gold, scale: 1.55 } } },
    21: { x: 0.5, y: 0.125, color: PAL.violetNeon, words: { 1: { color: PAL.cyan }, 4: { anim: 'stamp', color: PAL.gold, scale: 1.35 } } },
    22: { x: 0.05, y: 0.13, align: 'left', maxWidth: 0.9, color: PAL.pink, words: { 1: { scale: 1.1 }, 3: { anim: 'stamp', color: PAL.gold, scale: 1.7 } } },
    23: { x: 0.5, y: 0.12, color: PAL.pink, size: 90, hold: 0.06, words: { 3: { scale: 1.1 }, 4: { anim: 'stamp', color: PAL.gold, scale: 1.3 } } },
    24: { x: 0.5, y: 0.85, color: PAL.gold, size: 110, tilt: -0.03, words: { 1: { color: '#e6e0f2', core: 0.75 }, 2: { anim: 'stamp', scale: 1.7, color: PAL.red, core: 0.3, shake: 0.4 } } },
  },
};
