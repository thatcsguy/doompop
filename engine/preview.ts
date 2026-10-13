// The live preview: audio-locked playback, scrubbing, frame stepping, shot navigation.
import type { Engine } from './engine';

export function startPreview(engine: Engine, t0 = 0) {
  const audio = new Audio(engine.song.audioUrl);
  audio.preload = 'auto';
  let t = t0, playing = false, loopShot: { start: number; end: number } | null = null, fine = false;
  audio.currentTime = t0;

  const scrub = document.getElementById('scrub')!;
  const info = document.getElementById('info')!;
  const D = engine.duration;
  const pct = (x: number) => `${(x / D) * 100}%`;
  for (const s of engine.song.audio.sections) {
    const el = document.createElement('div');
    el.className = 'sec'; el.style.left = pct(s.start); el.style.width = pct(s.end - s.start);
    el.textContent = s.label ?? s.id;
    scrub.appendChild(el);
  }
  const shotEls = engine.shots.map(s => {
    const el = document.createElement('div');
    el.className = 'shot'; el.style.left = pct(s.start); el.style.width = pct(s.end - s.start); el.title = s.id;
    scrub.appendChild(el);
    return el;
  });
  const head = document.createElement('div'); head.className = 'head'; scrub.appendChild(head);

  const seek = (x: number) => { t = Math.max(0, Math.min(D - 1e-3, x)); audio.currentTime = t; };
  scrub.addEventListener('pointerdown', e => {
    const move = (ev: PointerEvent) => { const r = scrub.getBoundingClientRect(); seek(((ev.clientX - r.left) / r.width) * D); };
    move(e);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true });
  });

  const frameDt = 1 / engine.fps;
  window.addEventListener('keydown', e => {
    const i = engine.shotIndexAt(t);
    switch (e.key) {
      case ' ': e.preventDefault(); playing = !playing; playing ? audio.play() : audio.pause(); break;
      case 'ArrowLeft': seek(t - (e.shiftKey ? 5 : 1)); break;
      case 'ArrowRight': seek(t + (e.shiftKey ? 5 : 1)); break;
      case ',': seek(t - frameDt); break;
      case '.': seek(t + frameDt); break;
      case '[': seek(engine.shots[Math.max(0, i - (t - engine.shots[i].start < 0.3 ? 1 : 0))].start); break;
      case ']': if (i + 1 < engine.shots.length) seek(engine.shots[i + 1].start); break;
      case 'l': loopShot = loopShot ? null : engine.shots[i]; break;
      case 'q': fine = !fine; break;
      case 'h': document.body.classList.toggle('clean'); break;
    }
  });

  const tick = () => {
    if (playing) {
      t = audio.currentTime;
      if (loopShot && t >= loopShot.end) seek(loopShot.start);
      if (audio.ended) playing = false;
    }
    engine.renderAt(t, { samples: !playing && fine ? 8 : 1 });
    const i = engine.shotIndexAt(t), shot = engine.shots[i];
    shotEls.forEach((el, k) => el.classList.toggle('on', k === i));
    head.style.left = pct(t);
    const b = engine.clock.bar(t), beat = engine.clock.beat(t);
    info.textContent = '';
    for (const s of [
      `${t.toFixed(3)}s`, `frame ${Math.round(t * engine.fps)}`,
      `bar ${Math.floor(b) + 1}.${(Math.floor(beat - engine.clock.beat(engine.clock.barTime(Math.floor(b)))) + 1)}`,
      `shot ${shot.id}`, engine.clock.section(t)?.id ?? '', loopShot ? 'LOOP' : '', fine ? 'FINE' : '',
      'space play · ←/→ seek · ,/. frame · [/] shot · l loop · q fine · h hide',
    ]) { const s2 = document.createElement('span'); s2.textContent = s; info.appendChild(s2); }
    requestAnimationFrame(tick);
  };
  tick();
}
