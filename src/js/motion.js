// Motion toolkit: damped-spring reveal, parallax, spotlight, scroll progress, count-up, mesh canvas.
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Damped harmonic oscillator (semi-implicit Euler, fixed step). Resolves x from 0 -> 1.
export function spring(onFrame, { stiffness = 170, damping = 19, mass = 1 } = {}) {
  return new Promise((resolve) => {
    let x = 0, v = 0, last = performance.now();
    const step = (now) => {
      let dt = Math.min(0.032, (now - last) / 1000); last = now;
      while (dt > 0) {
        const h = Math.min(dt, 1 / 240); dt -= h;
        v += (-stiffness * (x - 1) - damping * v) / mass * h;
        x += v * h;
      }
      const done = Math.abs(x - 1) < 0.0015 && Math.abs(v) < 0.01;
      onFrame(done ? 1 : x);
      done ? resolve() : requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

export function initReveal(root = document) {
  const els = [...root.querySelectorAll('[data-reveal]:not([data-revealed])')];
  if (reduced() || !('IntersectionObserver' in window)) { els.forEach((e) => { e.dataset.revealed = '1'; e.style.opacity = 1; }); return; }
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const el = en.target; io.unobserve(el);
      const i = Number(el.style.getPropertyValue('--i') || 0);
      setTimeout(() => {
        el.dataset.revealed = '1';
        spring((p) => { el.style.opacity = Math.min(1, p * 1.4); el.style.transform = `translate3d(0,${(1 - p) * 26}px,0)`; })
          .then(() => { el.style.transform = ''; el.style.opacity = ''; });
        // rAF is throttled in background tabs: guarantee the settled state
        setTimeout(() => { el.style.transform = ''; el.style.opacity = ''; }, 1600);
      }, i * 70);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach((e) => io.observe(e));
}

export function initSpotlight() {
  if (reduced()) return;
  document.addEventListener('pointermove', (e) => {
    const t = e.target.closest?.('.spot');
    if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty('--mx', e.clientX - r.left + 'px');
    t.style.setProperty('--my', e.clientY - r.top + 'px');
  }, { passive: true });
}

export function initProgress(bar) {
  const set = () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
  };
  addEventListener('scroll', set, { passive: true }); addEventListener('resize', set); set();
}

export function initParallax(stage) {
  if (reduced()) return;
  const layers = [...stage.querySelectorAll('[data-depth]')];
  let px = 0, py = 0, tx = 0, ty = 0, sy = 0, raf = 0;
  const loop = () => {
    px += (tx - px) * 0.08; py += (ty - py) * 0.08;
    for (const l of layers) {
      const d = Number(l.dataset.depth);
      l.style.transform = `translate3d(${px * d * 26}px,${py * d * 26 - sy * d * 0.16}px,0)` + (l.dataset.tilt ? ` rotateY(${px * 10}deg) rotateX(${-py * 8}deg)` : '');
    }
    raf = (Math.abs(tx - px) > 0.001 || Math.abs(ty - py) > 0.001) ? requestAnimationFrame(loop) : 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5; kick();
  }, { passive: true });
  stage.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
  addEventListener('scroll', () => { sy = scrollY; kick(); }, { passive: true });
  kick();
}

// Count-up with flash on value change.
export function setNumber(el, value, fmt) {
  const prev = el._v;
  if (value == null) { el._v = null; el.textContent = fmt(null); return; }
  el._v = value;
  if (reduced()) { el.textContent = fmt(value); return; }
  const from = prev == null ? 0 : prev;
  if (prev != null && prev !== value) {
    el.classList.remove('flash-up', 'flash-down'); void el.offsetWidth;
    el.classList.add(value > prev ? 'flash-up' : 'flash-down');
  }
  if (from === value) { el.textContent = fmt(value); return; }
  const t0 = performance.now(), dur = 700;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (value - from) * e);
    if (k < 1) requestAnimationFrame(step); else el.textContent = fmt(value);
  };
  requestAnimationFrame(step);
  // rAF is throttled in background tabs: always land on the final value
  setTimeout(() => { if (el._v === value) el.textContent = fmt(value); }, dur + 120);
}

// Faint concentric swirl lines on near-black. Colour comes from the --ink token only.
export function initMesh(canvas) {
  const ctx = canvas.getContext('2d');
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
  let w = 0, h = 0, visible = true;
  const resize = () => { const r = canvas.getBoundingClientRect(); w = canvas.width = Math.max(2, r.width | 0); h = canvas.height = Math.max(2, r.height | 0); draw(performance.now()); };
  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    const cx = w * 0.5, cy = h * 0.42, rings = 26, step = Math.max(w, h) / 30, ph = t * 0.00035;
    ctx.strokeStyle = ink; ctx.lineWidth = 1;
    for (let k = 1; k <= rings; k++) {
      ctx.globalAlpha = Math.max(0.015, 0.075 - k * 0.0021);
      ctx.beginPath();
      for (let a = 0; a <= 64; a++) {
        const th = (a / 64) * Math.PI * 2;
        const wob = step * 0.45 * Math.sin(3 * th + ph * 2 + k * 0.38) + step * 0.2 * Math.sin(5 * th - ph * 3 + k * 0.21);
        const r = k * step + wob, x = cx + Math.cos(th + ph * 0.4) * r * 1.25, y = cy + Math.sin(th + ph * 0.4) * r * 0.8;
        a ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  const loop = (t) => { if (visible && !document.hidden) draw(t); requestAnimationFrame(loop); };
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(canvas);
  resize();
  if (!reduced()) requestAnimationFrame(loop);
}

// 3D perspective carousel: large centre card, cards scale + rotate toward the edges, drag-responsive.
export function initCarousel(viewport, track) {
  let offset = 0, vel = 0, drag = null, moved = 0, hover = false, last = performance.now();
  const cards = () => [...track.children].filter((c) => c.classList.contains('tr-card'));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function layout() {
    const list = cards(), n = list.length; if (!n) return;
    const cw = list[0].offsetWidth || 150, gap = cw * 0.74;
    list.forEach((el, i) => {
      let p = (((i - offset) % n) + n) % n; if (p > n / 2) p -= n;
      const ap = Math.abs(p);
      const scale = 1.28 - clamp(ap, 0, 3.2) * 0.22;
      const rot = clamp(-p * 32, -62, 62);
      const x = Math.sign(p) * (Math.min(ap, 1) * gap * 1.18 + Math.max(0, ap - 1) * gap * 0.82);
      el.style.transform = `translate(-50%,-50%) translate3d(${x}px,0,${-ap * 70}px) rotateY(${rot}deg) scale(${Math.max(0.5, scale)})`;
      el.style.opacity = clamp(1 - (ap - 2.8) * 0.45, 0, 1);
      el.style.zIndex = 100 - Math.round(ap * 10);
      el.style.pointerEvents = ap > 4.2 ? 'none' : '';
    });
  }
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!drag) {
      if (!reduced()) {
        vel *= Math.pow(0.04, dt);
        offset += vel * dt + (hover || Math.abs(vel) > 0.25 ? 0 : 0.22 * dt);
      }
    }
    layout(); requestAnimationFrame(frame);
  };
  viewport.addEventListener('pointerenter', () => { hover = true; });
  viewport.addEventListener('pointerleave', () => { hover = false; });
  viewport.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, t: performance.now() }; moved = 0; vel = 0; viewport.classList.add('dragging');
    viewport.setPointerCapture?.(e.pointerId);
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const cw = cards()[0]?.offsetWidth || 150, dx = e.clientX - drag.x, now = performance.now();
    const d = -dx / (cw * 0.8); offset += d; moved += Math.abs(dx);
    vel = d / Math.max(0.008, (now - drag.t) / 1000); drag = { x: e.clientX, t: now };
  });
  const end = () => { if (!drag) return; drag = null; viewport.classList.remove('dragging'); vel = clamp(vel, -6, 6); if (reduced()) vel = 0; };
  viewport.addEventListener('pointerup', end); viewport.addEventListener('pointercancel', end);
  viewport.addEventListener('click', (e) => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
  viewport.addEventListener('dragstart', (e) => e.preventDefault());
  new MutationObserver(layout).observe(track, { childList: true });
  layout();
  requestAnimationFrame(frame);
}

