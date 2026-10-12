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
    // verse 2: the lab. Checking lines type out; staging is cyan and prod pink wherever they appear
    25: { ...TERM, x: 0.05, y: 0.1, align: 'left', maxWidth: 0.7, words: { 5: { color: '#d8ffe6' } } },
    26: { x: 0.5, y: 0.13, color: PAL.cyan, words: { 1: { color: PAL.pink }, 3: { anim: 'stamp', color: PAL.gold, scale: 1.4 } } },
    27: { x: 0.5, y: 0.18, size: 88, maxWidth: 0.9, color: PAL.violetNeon, words: { 1: { color: PAL.cyan, scale: 1.1 }, 3: { color: PAL.pink, scale: 1.1 }, 4: { anim: 'stamp', color: PAL.gold, scale: 1.2 } } },
    28: { x: 0.5, y: 0.13, color: PAL.gold, words: { 2: { anim: 'stamp', color: PAL.cyan, scale: 1.25 }, 4: { anim: 'stamp', color: PAL.pink, scale: 1.25 } } },
    29: { ...TERM, x: 0.05, y: 0.88, align: 'left', maxWidth: 0.8, words: { 3: { color: '#d8ffe6', scale: 1.15 } } },
    30: { x: 0.5, y: 0.13, color: PAL.cyan, words: { 3: { anim: 'stamp', color: PAL.green, scale: 1.5, core: 0.4 } } },
    31: { ...TERM, x: 0.05, y: 0.1, align: 'left', maxWidth: 0.8, words: { 1: { color: '#d8ffe6' } } },
    32: { x: 0.5, y: 0.13, color: PAL.violetNeon, words: { 2: { anim: 'stamp', color: PAL.red, scale: 1.45, core: 0.3 }, 4: { shake: 0.8, color: PAL.gold } } },
    33: { x: 0.5, y: 0.12, color: PAL.pink, skip: [0, 1], words: { 4: { anim: 'stamp', color: PAL.gold, scale: 1.35 } } },
    34: { x: 0.5, y: 0.13, color: PAL.cyan, words: { 1: { scale: 1.1 }, 3: { anim: 'stamp', color: PAL.gold, scale: 0.9 } } },
    35: { x: 0.05, y: 0.13, align: 'left', maxWidth: 0.6, color: PAL.violetNeon, words: { 1: { color: '#9fd8ff' }, 3: { anim: 'stamp', color: PAL.gold, scale: 1.3, shake: 0.3 } } },
    36: { x: 0.5, y: 0.13, color: PAL.pink, words: { 1: { scale: 1.1 }, 2: { anim: 'stamp', color: PAL.gold, scale: 1.4 } } },
    37: { x: 0.5, y: 0.12, size: 90, maxWidth: 0.92, color: PAL.cyan, words: { 3: { anim: 'stamp', color: PAL.red, scale: 1.3, core: 0.3 } } },
    38: { x: 0.5, y: 0.13, color: PAL.violetNeon, words: { 3: { color: PAL.red, core: 0.35, scale: 1.25 }, 5: { anim: 'slide', color: PAL.gold } } },
    39: { x: 0.5, y: 0.13, color: PAL.pink, words: { 2: { color: PAL.gold, scale: 1.15 }, 3: { anim: 'stamp', color: PAL.gold, scale: 1.3 } } },
    40: { x: 0.5, y: 0.13, color: PAL.cyan, hold: 0.06, words: { 1: { scale: 1.1 }, 4: { anim: 'stamp', color: PAL.gold, scale: 1.35, shake: 0.25 } } },
    // chorus 2: chorus 1's looks, a notch bigger; lines move to the bottom where the wall shots
    // need the top of the frame
    41: { x: 0.5, y: 0.13, color: PAL.cyan, words: { 1: { color: PAL.green }, 3: { anim: 'slide' }, 4: { anim: 'slide' }, 5: { anim: 'stamp', color: PAL.gold, scale: 1.3 } } },
    42: { x: 0.5, y: 0.87, size: 92, maxWidth: 0.92, color: PAL.pink, words: { 1: { color: PAL.cyan, scale: 1.1 }, 4: { anim: 'stamp', color: PAL.gold, scale: 1.35 } } },
    43: { x: 0.5, y: 0.12, size: 90, maxWidth: 0.92, color: PAL.violetNeon, words: { 1: { color: PAL.gold, scale: 1.15 }, 4: { anim: 'stamp', color: PAL.red, scale: 1.45, core: 0.3 } } },
    44: { x: 0.5, y: 0.13, color: PAL.pink, words: { 1: { color: PAL.cyan }, 3: { anim: 'stamp', color: PAL.gold, scale: 1.6 } } },
    45: { x: 0.5, y: 0.125, color: PAL.violetNeon, words: { 1: { color: PAL.cyan }, 4: { anim: 'stamp', color: PAL.gold, scale: 1.4 } } },
    46: { x: 0.05, y: 0.13, align: 'left', maxWidth: 0.9, color: PAL.pink, words: { 1: { scale: 1.1 }, 3: { anim: 'stamp', color: PAL.gold, scale: 1.8 } } },
    47: { x: 0.5, y: 0.12, color: PAL.pink, size: 90, hold: 0.06, words: { 3: { scale: 1.1 }, 4: { anim: 'stamp', color: PAL.gold, scale: 1.35 } } },
    48: { x: 0.5, y: 0.85, color: PAL.gold, size: 116, tilt: -0.03, words: { 1: { color: '#e6e0f2', core: 0.75 }, 2: { anim: 'stamp', scale: 1.8, color: PAL.red, core: 0.3, shake: 0.4 } } },
    // bridge: line 49 is Clawd's speech bubble; the bar lines sit low under the two of them, the
    // floor and booth lines go where each shot leaves room
    49: { skip: [0, 1, 2, 3] },
    50: { x: 0.5, y: 0.13, color: PAL.cyan, words: { 1: { anim: 'stamp', color: PAL.red, scale: 1.3, core: 0.35 }, 4: { color: PAL.gold, scale: 1.15 } } },
    51: { ...TERM, x: 0.05, y: 0.1, align: 'left', maxWidth: 0.8, words: { 1: { color: '#ff8a5a' }, 2: { color: '#ff8a5a' }, 4: { color: '#d8ffe6', scale: 1.15 } } },
    52: { x: 0.5, y: 0.87, color: PAL.violetNeon, words: { 3: { color: PAL.cyan, scale: 1.15 }, 4: { shake: 0.4 }, 5: { shake: 0.4 } } },
    53: { ...TERM, x: 0.05, y: 0.9, align: 'left', maxWidth: 0.86, words: { 3: { color: PAL.gold, scale: 1.1 }, 4: { color: '#d8ffe6' } } },
    54: { x: 0.95, y: 0.13, align: 'right', color: PAL.pink, maxWidth: 0.7, words: { 1: { color: PAL.gold, scale: 1.15 }, 2: { color: PAL.cyan }, 4: { anim: 'stamp', color: '#9dfff0', scale: 1.4 } } },
    55: { ...TERM, x: 0.05, y: 0.915, align: 'left', maxWidth: 0.9, words: { 1: { color: PAL.red, scale: 1.2 }, 3: { color: '#d8ffe6' }, 4: { color: '#d8ffe6' } } },
    56: { x: 0.5, y: 0.14, color: PAL.cyan, size: 104, hold: 0.0, words: { 1: { scale: 1.1 }, 3: { anim: 'stamp', color: PAL.green, scale: 1.8, core: 0.45 } } },
    // final chorus: the good news in green and gold; the three "smoking gun" lines keep the
    // chorus look (pale "smoking", a big stamped "gun") and go where each shot has room
    57: { x: 0.5, y: 0.12, color: PAL.cyan, words: { 3: { color: PAL.gold, scale: 1.1 }, 4: { anim: 'slide', color: PAL.green, scale: 1.3, core: 0.45 } } },
    58: { x: 0.5, y: 0.13, color: PAL.pink, words: { 1: { color: PAL.red, core: 0.35 }, 4: { anim: 'stamp', color: PAL.green, scale: 1.45, core: 0.45 } } },
    59: { x: 0.5, y: 0.9, size: 86, maxWidth: 0.95, color: PAL.pink, words: { 1: { color: PAL.gold }, 2: { color: PAL.cyan, scale: 1.1 }, 4: { anim: 'stamp', color: PAL.red, scale: 1.3, core: 0.3 } } },
    60: { x: 0.5, y: 0.1, color: PAL.cyan, words: { 1: { anim: 'slide' }, 3: { anim: 'stamp', color: PAL.gold, scale: 1.35 } } },
    61: { x: 0.5, y: 0.12, color: PAL.pink, words: { 1: { color: PAL.gold, scale: 1.15 }, 2: { shake: 0.4 }, 3: { anim: 'stamp', color: PAL.green, scale: 1.3, core: 0.45 } } },
    62: { x: 0.5, y: 0.12, color: PAL.violetNeon, words: { 1: { color: PAL.red, core: 0.35 }, 4: { anim: 'pop', color: PAL.gold, scale: 1.35 } } },
    63: { x: 0.5, y: 0.12, color: PAL.gold, hold: 0.1, words: { 2: { color: PAL.cyan }, 3: { anim: 'stamp', color: PAL.pink, scale: 1.3 }, 4: { scale: 1.45, shake: 0.6 } } },
    64: { x: 0.5, y: 0.86, color: PAL.gold, size: 120, tilt: -0.03, words: { 1: { color: '#e6e0f2', core: 0.75 }, 2: { anim: 'stamp', scale: 1.9, color: PAL.red, core: 0.3, shake: 0.4 } } },
    65: { x: 0.5, y: 0.11, color: PAL.gold, size: 104, tilt: -0.03, words: { 1: { color: '#e6e0f2', core: 0.75 }, 2: { anim: 'stamp', scale: 1.6, core: 0.5 } } },
    66: { x: 0.5, y: 0.13, color: PAL.pink, size: 110, tilt: -0.03, words: { 1: { color: '#e6e0f2', core: 0.75 }, 2: { anim: 'stamp', scale: 1.7, color: PAL.gold, core: 0.5 } } },
  },
};
