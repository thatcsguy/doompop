// Kinetic lyric layouts for "I'm Just Here to Help", one entry per lyric line (1-based, as in
// data/lyrics.json). Each layout puts the line in its shot's empty space. Word keys are 0-based.
import type { KineticLayout, KineticSpec } from '../../engine/kinetic';
import { MONO } from './world';

// The bridge's commands, typed into a terminal at the bottom left; each new one scrolls the last up.
const TERM: Partial<KineticLayout> = {
  x: 0.05, y: 0.88, align: 'left', size: 62, maxWidth: 0.9, font: MONO, prompt: '>', promptColor: '#ffd166', transform: 'lower',
  panel: 'rgba(9,12,28,0.86)', cursor: true, stack: 'cmd', anim: 'type', color: '#8dffb0', outline: 'rgba(0,0,0,0)', shadow: '',
  hold: 5, exit: 'fade',
};
const TERM_HOT = '#ffffff', TERM_RED = '#ff5a4f';

const ORANGE = '#d2603f', GREEN = '#2f8f55', RED = '#d6453d', GOLD = '#e39a2d', BLUE = '#3f86c9', PURPLE = '#7b4fa0';

export const KINETIC: KineticSpec = {
  base: { size: 84, anim: 'pop', y: 0.16 },
  lines: {
    // verse 1
    1: { x: 0.07, y: 0.3, align: 'left', maxWidth: 0.36, anim: 'drop', size: 92,
      words: { 3: { color: ORANGE, scale: 1.3 }, 6: { color: ORANGE, scale: 1.2, anim: 'stamp' } } },
    2: { y: 0.17, boxed: true, anim: 'type', size: 70, maxWidth: 0.9, words: { 2: { scale: 1.25, color: ORANGE } } },
    3: { y: 0.12, size: 76, maxWidth: 0.95, words: { 5: { color: GREEN, scale: 1.4, anim: 'stamp' }, 7: { color: RED, scale: 1.4, anim: 'stamp' } } },
    4: { y: 0.14, anim: 'wave', size: 80, maxWidth: 0.85, words: { 5: { color: ORANGE, scale: 1.3 } } },
    5: { y: 0.12, size: 74, maxWidth: 0.9,
      words: { 1: { color: GREEN, scale: 1.15 }, 3: { scale: 1.15 }, 5: { color: GREEN, scale: 1.15 }, 7: { scale: 1.15 } } },
    6: { x: 0.95, y: 0.2, align: 'right', maxWidth: 0.5, size: 84,
      words: { 1: { shake: 1, color: '#7a6a5e' }, 6: { color: GOLD, scale: 1.45, anim: 'stamp' } } },
    7: { x: 0.965, y: 0.14, align: 'right', maxWidth: 0.36, size: 70,
      words: { 1: { color: ORANGE, scale: 1.2 }, 7: { color: ORANGE, scale: 1.3, anim: 'stamp' } } },
    // "I'm here to help" is typed into Clawd's speech bubble instead (shots/verse1.ts)
    8: { x: 0.06, y: 0.16, align: 'left', anim: 'slide', size: 92, skip: [4, 5, 6, 7] },
    // pre-chorus: the office (shots/chorus1.ts)
    9: { y: 0.86, size: 88, words: { 3: { color: ORANGE, scale: 1.3 } } },
    10: { x: 0.95, y: 0.15, align: 'right', size: 88, words: { 3: { color: RED, scale: 1.4, anim: 'stamp' } } },
    11: { x: 0.05, y: 0.85, align: 'left', size: 84, anim: 'slide', words: { 3: { color: '#7b4fa0', scale: 1.3, shake: 0.6 } } },
    12: { x: 0.05, y: 0.14, align: 'left', size: 84, hold: 0.2, words: { 3: { color: GREEN, scale: 1.45, anim: 'stamp' } } },
    // chorus 1: lines alternate sides, call and response
    13: { x: 0.95, y: 0.14, align: 'right', size: 84, anim: 'slide', words: { 4: { color: ORANGE, scale: 1.4, anim: 'stamp' } } },
    14: { x: 0.05, y: 0.13, align: 'left', size: 84, words: { 4: { color: '#3f86c9', scale: 1.4 } } },
    15: { x: 0.95, y: 0.13, align: 'right', size: 70, boxed: true, anim: 'drop', words: { 4: { color: '#7b4fa0', scale: 1.15 } } },
    16: { x: 0.05, y: 0.15, align: 'left', size: 100, anim: 'drop', words: { 1: { color: ORANGE, scale: 1.25, anim: 'stamp' } } },
    17: { x: 0.95, y: 0.13, align: 'right', size: 80, words: { 4: { color: GOLD, scale: 1.3 } } },
    18: { y: 0.88, size: 80, anim: 'slide', words: { 4: { color: ORANGE, scale: 1.3 } } },
    19: { x: 0.96, y: 0.3, align: 'right', size: 80, maxWidth: 0.36, words: { 4: { color: GOLD, scale: 1.35, shake: 0.5 } } },
    20: { y: 0.13, size: 100, anim: 'wave', maxWidth: 0.9, words: { 4: { color: ORANGE, scale: 1.3 } } },
    // verse 2: the server room (shots/verse2.ts)
    21: { x: 0.05, y: 0.13, align: 'left', size: 84, maxWidth: 0.62, words: { 3: { color: ORANGE, scale: 1.3 }, 7: { color: GOLD, scale: 1.45, anim: 'stamp', shake: 0.6 } } },
    22: { x: 0.64, y: 0.11, size: 80, maxWidth: 0.66, anim: 'slide', words: { 3: { color: GREEN, scale: 1.3 }, 6: { color: GOLD, scale: 1.45, anim: 'stamp' } } },
    23: { x: 0.05, y: 0.14, align: 'left', size: 84, maxWidth: 0.4, words: { 1: { color: RED, shake: 0.7 }, 4: { color: RED }, 5: { color: RED, scale: 1.35, anim: 'stamp' } } },
    24: { y: 0.9, size: 84, anim: 'slide', words: { 3: { color: ORANGE, scale: 1.3 }, 7: { color: GOLD, scale: 1.45, anim: 'stamp' } } },
    25: { y: 0.13, size: 84, maxWidth: 0.9, words: { 1: { color: GREEN }, 3: { color: BLUE }, 4: { color: GOLD, scale: 1.4, anim: 'stamp' }, 6: { color: PURPLE } } },
    26: { x: 0.95, y: 0.13, align: 'right', size: 88, maxWidth: 0.42, hold: 0, words: { 0: { color: ORANGE, scale: 1.35, anim: 'stamp' }, 4: { color: '#7a6a5e', shake: 0.6 } } },
    // "Don't wake us up, just fix yourself" is said by the sleepers, in speech bubbles
    27: { skip: [0, 1, 2, 3, 4, 5, 6] },
    28: { x: 0.95, y: 0.42, align: 'right', size: 84, maxWidth: 0.36, anim: 'wave', hold: 0.15, words: { 2: { color: '#7a6a5e' }, 5: { color: ORANGE, scale: 1.35 } } },
    // the montage: one line per shot, quick, jumping around the frame
    29: { x: 0.95, y: 0.13, align: 'right', size: 92, hold: 0.05, words: { 3: { color: '#e3a882', scale: 1.35, anim: 'stamp' } } },
    30: { y: 0.84, size: 92, hold: 0.05, words: { 1: { color: BLUE, scale: 1.25 }, 3: { color: ORANGE, scale: 1.3, anim: 'stamp' } } },
    31: { x: 0.05, y: 0.14, align: 'left', size: 92, hold: 0.05, words: { 3: { color: BLUE, scale: 1.35 } } },
    32: { x: 0.06, y: 0.86, align: 'left', size: 92, hold: 0.05, words: { 3: { color: GREEN, scale: 1.4, anim: 'stamp' } } },
    33: { x: 0.96, y: 0.13, align: 'right', size: 84, maxWidth: 0.4, hold: 0.05, words: { 3: { color: GOLD, scale: 1.3 } } },
    34: { x: 0.96, y: 0.87, align: 'right', size: 84, maxWidth: 0.4, hold: 0.05, words: { 3: { color: RED, scale: 1.35, anim: 'stamp' } } },
    35: { x: 0.96, y: 0.13, align: 'right', size: 84, maxWidth: 0.4, hold: 0.05, words: { 3: { color: GOLD, scale: 1.2, shake: 0.4 } } },
    36: { x: 0.05, y: 0.15, align: 'left', size: 92, maxWidth: 0.5, hold: 0, words: { 2: { color: GREEN, scale: 1.3, anim: 'stamp' }, 3: { color: '#8a8079', scale: 0.9 } } },
    // chorus 2: the whole building at night (shots/chorus2.ts)
    37: { x: 0.95, y: 0.13, align: 'right', size: 84, anim: 'slide', hold: 0, exit: 'shrink', words: { 4: { color: ORANGE, scale: 1.4, anim: 'stamp', shake: 0.5 } } },
    38: { x: 0.05, y: 0.13, align: 'left', size: 84, words: { 4: { color: BLUE, scale: 1.4 } } },
    39: { y: 0.88, size: 84, maxWidth: 0.9, words: { 4: { color: ORANGE, scale: 1.25 }, 5: { color: ORANGE, scale: 1.35, anim: 'stamp' } } },
    40: { y: 0.13, size: 96, anim: 'drop', words: { 1: { color: ORANGE, scale: 1.45, anim: 'stamp' }, 3: { color: GREEN, scale: 1.45, anim: 'stamp' } } },
    41: { x: 0.05, y: 0.87, align: 'left', size: 84, maxWidth: 0.6, words: { 5: { color: GOLD, scale: 1.4, anim: 'stamp' } } },
    42: { x: 0.05, y: 0.34, align: 'left', size: 84, maxWidth: 0.3, anim: 'wave', hold: 0.2, words: { 3: { color: '#5a6fb0', scale: 1.25 } } },
    43: { x: 0.95, y: 0.34, align: 'right', size: 84, maxWidth: 0.3, hold: 0.2, words: { 3: { color: '#2aa3c4', scale: 1.3 } } },
    44: { y: 0.12, size: 96, anim: 'wave', hold: 0.1, words: { 4: { color: ORANGE, scale: 1.35, shake: 0.35 } } },
    // bridge part 1: the command centre (shots/bridge1.ts)
    45: { ...TERM, words: { 2: { color: TERM_HOT } } },
    46: { ...TERM, words: { 2: { color: TERM_HOT } } },
    47: { ...TERM, words: { 2: { color: TERM_HOT } } },
    48: { ...TERM, words: { 2: { color: TERM_HOT } } },
    49: { ...TERM, words: { 2: { color: TERM_HOT } } },
    50: { ...TERM, words: { 2: { color: TERM_HOT } } },
    51: { ...TERM, words: { 2: { color: TERM_RED } } },
    52: { ...TERM, words: { 2: { color: TERM_RED } } },
    // bridge part 2: the globe (shots/bridge2.ts)
    53: { ...TERM, words: { 2: { color: TERM_HOT } } },
    54: { ...TERM, words: { 2: { color: TERM_HOT } } },
    55: { ...TERM, words: { 2: { color: TERM_RED } } },
    56: { ...TERM, words: { 1: { color: TERM_HOT } } },
    57: { ...TERM, words: { 2: { color: TERM_RED } } },
    // the terminal clears together on the cut to the dark room (2:13.6)
    58: { ...TERM, hold: 2.3, words: { 2: { color: TERM_HOT } } },
    59: { ...TERM, hold: 1.18, words: { 3: { color: TERM_RED } } },
    60: { ...TERM, hold: 0, words: { 2: { color: TERM_RED } } },
    // bridge part 3 (shots/bridge3.ts): the orders themselves are in the speech bubbles
    61: { x: 0.05, y: 0.86, align: 'left', size: 84, anim: 'slide', skip: [2, 3, 4], words: { 1: { color: '#7a6a5e' } } },
    62: { x: 0.95, y: 0.86, align: 'right', size: 84, anim: 'slide', skip: [2, 3, 4], words: { 1: { color: '#7a6a5e' } } },
    63: { x: 0.05, y: 0.86, align: 'left', size: 96, anim: 'stamp', hold: 0.2, skip: [2, 3, 4], words: { 1: { color: RED, shake: 0.4 } } },
    64: { x: 0.95, y: 0.86, align: 'right', size: 104, anim: 'stamp', hold: 0, exit: 'shrink', skip: [2, 3, 4], words: { 0: { shake: 0.5 }, 1: { color: RED, shake: 0.8 } } },
    65: { x: 0.05, y: 0.86, align: 'left', size: 84, hold: 0.05, words: { 3: { color: GREEN, scale: 1.3 } } },
    66: { x: 0.95, y: 0.86, align: 'right', size: 84, hold: 0.05, words: { 2: { color: GREEN, scale: 1.35, shake: 0.5 } } },
    67: { y: 0.86, size: 88, hold: 0.05, words: { 3: { color: GOLD, scale: 1.4, anim: 'stamp' } } },
    68: { y: 0.86, size: 92, hold: 0, exit: 'shrink', words: { 3: { color: RED, scale: 1.5, anim: 'stamp', shake: 0.6 } } },
    // bridge part 4: the chat box, nobody, the button
    69: { y: 0.27, size: 84, anim: 'type', hold: 0, exit: 'fade', words: { 3: { color: BLUE, scale: 1.2 } } },
    70: { y: 0.84, size: 110, anim: 'drop', hold: 0, exit: 'fade', words: { 0: { color: '#5a6fb0' }, 2: { color: '#7a6a5e', scale: 1.15 } } },
    71: { y: 0.88, size: 84, hold: 0, words: { 1: { color: RED }, 3: { color: RED, scale: 1.3, shake: 0.5 } } },
    72: { x: 0.04, y: 0.24, align: 'left', size: 76, maxWidth: 0.3, anim: 'drop', hold: 0, exit: 'fade', words: { 5: { color: ORANGE, scale: 1.3 } } },
    73: { y: 0.85, size: 150, anim: 'stamp', color: '#fffaf0', outline: '#2b1d16', shadow: 'rgba(0,0,0,0.4)', hold: 0.7, exit: 'fade' },
    74: { x: 0.05, y: 0.14, align: 'left', size: 80, maxWidth: 0.34, color: '#8a8784', hold: 0.15, exit: 'fade', words: { 3: { color: '#d8d4cf', scale: 1.3, shake: 0.5 } } },
    75: { x: 0.95, y: 0.14, align: 'right', size: 80, maxWidth: 0.34, color: '#d8d4cf', outline: '#2b1d16', hold: 0.4, exit: 'fade', words: { 3: { color: '#ffffff', scale: 1.35 } } },
    // final chorus: the grey planet (shots/outro.ts); slow, shaking, the colour gone out of it
    76: { y: 0.14, size: 84, maxWidth: 0.8, anim: 'drop', hold: 0.1, words: { 2: { shake: 0.4 }, 4: { color: '#a5463c', scale: 1.3, shake: 0.3 } } },
    77: { y: 0.16, size: 96, anim: 'drop', hold: 0.05, color: '#5a5652' },
    78: { x: 0.05, y: 0.14, align: 'left', size: 84, maxWidth: 0.5, hold: 0, words: { 1: { shake: 0.4 }, 3: { color: '#6f8f75', scale: 1.3, anim: 'stamp', shake: 0.5 } } },
    79: { x: 0.95, y: 0.14, align: 'right', size: 84, maxWidth: 0.5, hold: 0.05, words: { 2: { scale: 1.2, shake: 0.3 }, 3: { color: '#8a8784' } } },
    80: { x: 0.05, y: 0.14, align: 'left', size: 84, maxWidth: 0.5, hold: 0.1, words: { 2: { color: '#8a8784' }, 4: { scale: 1.2, shake: 0.6 } } },
    81: { y: 0.88, size: 88, hold: 0.2, words: { 3: { color: ORANGE, scale: 1.35, shake: 0.6 } } },
    82: { y: 0.16, size: 92, hold: 0, exit: 'shrink', words: { 2: { shake: 0.9 } } },
    83: { y: 0.85, size: 120, anim: 'drop', hold: 0.6, exit: 'fade', color: '#fffaf0', outline: '#2b1d16', shadow: 'rgba(0,0,0,0.35)' },
    84: { y: 0.84, size: 88, anim: 'wave', hold: 0.8, exit: 'fade', color: '#fffaf0', outline: '#2b1d16', words: { 4: { scale: 1.3 } } },
    // outro: quiet, typed, top left, while the credits roll on the right
    85: { x: 0.05, y: 0.14, align: 'left', size: 64, anim: 'type', hold: 0.2, exit: 'fade', color: '#4a4440' },
    86: { x: 0.05, y: 0.14, align: 'left', size: 64, anim: 'type', hold: 0.6, exit: 'fade', color: '#4a4440' },
  },
};
