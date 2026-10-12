// Kinetic lyric layouts for "I'm Just Here to Help", one entry per lyric line (1-based, as in
// data/lyrics.json). Each layout puts the line in its shot's empty space. Word keys are 0-based.
import type { KineticSpec } from '../../engine/kinetic';

const ORANGE = '#d2603f', GREEN = '#2f8f55', RED = '#d6453d', GOLD = '#e39a2d';

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
  },
};
