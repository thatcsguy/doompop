// The IMMINENT THREAT countdown: a HUD box that slams in on "Flag the danger" and ticks in real
// time, so it reads 00:00 exactly on "I helped." Every bridge shot draws it through withThreat();
// a shot can move it (centre, zoom it up for a close-up) or hide it with a placement function.
import type { Frame, Shot } from '../../engine/types';
import { rrPath } from '../../engine/flat';
import { clamp, easeOutBack, easeOutCubic, lerp } from '../../engine/ease';
import { FONT, MONO } from './world';

/** Song times: when the countdown appears, when it starts showing hundredths, when it hits zero. */
export const THREAT = { start: 121.87, fast: 139.21, zero: 168.52 };

/** Seconds left on the clock at song time t. */
export const threatLeft = (t: number) => Math.max(0, THREAT.zero - t);

/** Where the box sits: centre in 0..1 of the frame and a scale (1 = HUD size). */
export interface ThreatPlace { x: number; y: number; scale: number; alpha?: number; bracket?: number }
export const HUD: ThreatPlace = { x: 0.5, y: 0.085, scale: 1 };

export function threatText(t: number): string {
  const left = threatLeft(t);
  const s = Math.floor(left), m = Math.floor(s / 60);
  const two = (n: number) => String(n).padStart(2, '0');
  // from "respond at once" the clock shows hundredths: the same time, spinning faster
  if (t >= THREAT.fast) return `${two(m)}:${two(s % 60)}.${two(Math.floor((left - s) * 100))}`;
  return `${two(m)}:${two(s % 60)}.${Math.floor((left - s) * 10)}`;
}

/** Draw the countdown box. Units are 1080p pixels times place.scale. */
export function drawThreat(g: CanvasRenderingContext2D, f: Frame, place: ThreatPlace = HUD) {
  const t = f.t;
  if (t < THREAT.start) return;
  const u = (f.h / 1080) * place.scale;
  const lt = t - THREAT.start;
  const slam = easeOutBack(clamp(lt / 0.3), 2.2);
  const left = threatLeft(t);
  // under ten seconds it pulses on every second
  const pulse = left < 10 && left > 0 ? 1 + 0.05 * Math.pow(1 - (left % 1), 3) : 1;
  const s = lerp(1.8, 1, slam) * pulse;
  const w = 470 * u, h = 132 * u;
  g.save();
  g.globalAlpha = clamp(lt / 0.12) * (place.alpha ?? 1);
  g.translate(place.x * f.w, place.y * f.h);
  g.scale(s, s);
  // drop shadow, ink border, dark red face
  g.fillStyle = 'rgba(10,4,6,0.45)';
  rrPath(g, -w / 2 + 7 * u, -h / 2 + 9 * u, w, h, 14 * u); g.fill();
  g.fillStyle = '#2b1d16';
  rrPath(g, -w / 2 - 5 * u, -h / 2 - 5 * u, w + 10 * u, h + 10 * u, 17 * u); g.fill();
  g.fillStyle = '#1c0b0e';
  rrPath(g, -w / 2, -h / 2, w, h, 13 * u); g.fill();
  // hazard stripes along the top edge
  g.save();
  rrPath(g, -w / 2, -h / 2, w, h, 13 * u); g.clip();
  g.fillStyle = '#e0453a';
  g.fillRect(-w / 2, -h / 2, w, 34 * u);
  g.fillStyle = '#1c0b0e';
  for (let x = -w / 2 - 40 * u; x < w / 2; x += 26 * u) {
    g.beginPath(); g.moveTo(x, -h / 2); g.lineTo(x + 12 * u, -h / 2); g.lineTo(x + 24 * u, -h / 2 + 34 * u); g.lineTo(x + 12 * u, -h / 2 + 34 * u); g.fill();
  }
  // label plate over the stripes
  const blink = left > 0 ? (Math.floor(lt * 2) % 2 === 0 ? 1 : 0.55) : 1;
  g.fillStyle = '#e0453a';
  g.fillRect(-150 * u, -h / 2, 300 * u, 34 * u);
  g.fillStyle = `rgba(255,244,236,${blink})`;
  g.font = `900 ${23 * u}px ${FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('⚠  IMMINENT THREAT  ⚠', 0, -h / 2 + 18 * u);
  g.restore();
  // the digits: ghost segments behind, glowing red in front
  g.font = `700 ${78 * u}px ${MONO}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const txt = threatText(t);
  const dy = 20 * u;
  g.fillStyle = 'rgba(255,70,60,0.09)';
  g.fillText(txt.replace(/\d/g, '8'), 0, dy);
  const zero = left <= 0;
  // at zero it flashes slowly (well under three times a second)
  const on = zero ? (Math.floor((t - THREAT.zero) * 2.4) % 2 === 0 ? 1 : 0.25) : 1;
  g.shadowColor = '#ff3b30'; g.shadowBlur = 18 * u;
  g.fillStyle = `rgba(255,${zero ? 70 : 64},${zero ? 60 : 52},${on})`;
  g.fillText(txt, 0, dy);
  g.shadowBlur = 0;
  // the slam: a white flash ring as it lands
  if (lt < 0.35) {
    g.strokeStyle = `rgba(255,240,230,${1 - lt / 0.35})`;
    g.lineWidth = 8 * u * (1 - lt / 0.35);
    const k = easeOutCubic(lt / 0.35);
    rrPath(g, -w / 2 - 30 * u * k, -h / 2 - 30 * u * k, w + 60 * u * k, h + 60 * u * k, 20 * u); g.stroke();
  }
  // a targeting bracket closing on the box ("I found the window")
  if (place.bracket !== undefined && place.bracket > 0) {
    const k = easeOutCubic(place.bracket);
    const gap = lerp(140, 18, k) * u, L = 46 * u;
    g.strokeStyle = '#ffd34d'; g.lineWidth = 9 * u; g.lineCap = 'square';
    g.globalAlpha *= clamp(place.bracket * 3);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const cx = sx * (w / 2 + gap), cy = sy * (h / 2 + gap);
      g.beginPath(); g.moveTo(cx - sx * L, cy); g.lineTo(cx, cy); g.lineTo(cx, cy - sy * L); g.stroke();
    }
  }
  g.restore();
}

/**
 * Wrap shots so the countdown draws over them (under the lyrics) from THREAT.start until `until`.
 * place(f) moves it per frame; return null to hide it for that frame.
 */
export function withThreat(shot: Shot, place: (f: Frame) => ThreatPlace | null = () => HUD): Shot {
  return {
    ...shot,
    build(stage) {
      const w = shot.build(stage);
      const own = w.overlay;
      return {
        ...w,
        overlay(g, f) {
          if (own) { g.save(); own.call(w, g, f); g.restore(); }
          const p = place(f);
          if (p) drawThreat(g, f, p);
        },
      };
    },
  };
}
