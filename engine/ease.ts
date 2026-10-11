// Small easing and mapping helpers. All pure.

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** Map x from [a, b] to [0, 1], clamped. */
export const unlerp = (x: number, a: number, b: number) => clamp((x - a) / (b - a));
export const smooth = (k: number) => { k = clamp(k); return k * k * (3 - 2 * k); };
export const easeOutCubic = (k: number) => 1 - Math.pow(1 - clamp(k), 3);
export const easeInCubic = (k: number) => Math.pow(clamp(k), 3);
export const easeInOutCubic = (k: number) => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
export const easeOutBack = (k: number, s = 1.70158) => { k = clamp(k) - 1; return 1 + (s + 1) * k * k * k + s * k * k; };
/** Exponential decay from an event: 1 at dt = 0, falling with time constant tau. 0 before the event. */
export const decay = (dt: number, tau: number) => (dt < 0 || !isFinite(dt) ? 0 : Math.exp(-dt / tau));
