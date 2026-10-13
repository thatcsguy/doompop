// Deterministic randomness. Never use Math.random() in a shot: frames render
// out of order and in parallel, so anything random must come from a hash.

/** Hash an integer (or a few) to a float in [0, 1). */
export function hash(...n: number[]): number {
  let h = 0x811c9dc5;
  for (const v of n) {
    let x = Math.floor(v) | 0;
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
    x ^= x >>> 16;
    h = Math.imul(h ^ x, 0x01000193);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Hash to a float in [a, b). */
export const hashRange = (a: number, b: number, ...n: number[]) => a + (b - a) * hash(...n);

/** Smooth 1D value noise in [-1, 1]; continuous in x, so safe to sample at any t. */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash(i, seed) * 2 - 1, b = hash(i + 1, seed) * 2 - 1;
  return a + (b - a) * u;
}

/** Layered noise for camera drift and the like. */
export function fbm1(x: number, seed = 0, octaves = 3): number {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise1(x * freq, seed + o * 101);
    norm += amp; amp *= 0.5; freq *= 2;
  }
  return sum / norm;
}
