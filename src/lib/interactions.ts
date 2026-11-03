import { atlas, collect, fire } from './atlas.svelte';
import { sim } from './planet/sim.svelte';
import { track } from './track';

/** Where the bodies are on screen, in CSS pixels. The scene writes it every frame; the canvas itself never gets a pointer event. */
export const stage = { x: 0, y: 0, r: 0, cx: 0, cy: 0, cr: 0, binary: false, drag: 0 };

const IGNORE = 'a, button, input, dialog, summary, [data-seed]';
const near = (px: number, py: number, x: number, y: number, r: number) => Math.hypot(px - x, py - y) <= Math.max(r, 36);
const onPrimary = (x: number, y: number) => stage.r > 0 && near(x, y, stage.x, stage.y, stage.r);
const onCompanion = (x: number, y: number) => stage.binary && near(x, y, stage.cx, stage.cy, stage.cr);
const live = () => sim.state === 'LOCKED';

const SECTIONS: Record<string, string> = { payload: 'payload', missions: 'missions', 'off-duty': 'off-duty' };

/** Wires every way a visitor can earn something. Returns the cleanup. */
export function startInteractions(tz: string) {
  const off: (() => void)[] = [];
  const on = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
    addEventListener(type, fn as EventListener, opts);
    off.push(() => removeEventListener(type, fn as EventListener));
  };

  // taps and holds on the world; a mouse can also drag it round
  let down: { x: number; y: number; at: number; body: boolean } | null = null;
  let hold = 0;
  let last = { x: 0, y: 0 };
  let taps: { t: number; x: number; y: number }[] = [];
  let star: { second: boolean; t: number } | null = null;
  const stopHold = () => { clearTimeout(hold); document.body.style.userSelect = ''; };

  on('pointerdown', (e) => {
    if (e.button !== 0 || (e.target as Element)?.closest?.(IGNORE) || !live()) return;
    const body = onPrimary(e.clientX, e.clientY) || onCompanion(e.clientX, e.clientY);
    down = { x: e.clientX, y: e.clientY, at: performance.now(), body };
    last = { x: e.clientX, y: e.clientY };
    if (body && atlas.current.id === 'hole') hold = window.setTimeout(() => down && fire('accretion'), 3000);
  });
  on('pointermove', (e) => {
    if (!down) return;
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) clearTimeout(hold);
    if (down.body && e.pointerType === 'mouse' && e.buttons & 1) {
      stage.drag += (e.clientX - last.x) * 0.006;
      document.body.style.userSelect = 'none';
    }
    last = { x: e.clientX, y: e.clientY };
  });
  const tap = (x: number, y: number) => {
    const now = performance.now();
    const id = atlas.current.id;
    if (id === 'binary') {
      const second = onCompanion(x, y);
      if (!second && !onPrimary(x, y)) return;
      if (star && star.second !== second && now - star.t < 4000) { fire('barycentre'); star = null; } else star = { second, t: now };
      return;
    }
    if (!onPrimary(x, y)) return;
    taps = [...taps.filter((k) => now - k.t < 3000), { t: now, x, y }];
    if (id === 'comet') fire('catch');
    if (id === 'gas' && taps.length >= 5) { fire('stir'); taps = []; }
    if (id === 'pulsar' && taps.length >= 3) {
      const [a, b, c] = taps.slice(-3).map((k) => k.t);
      const [i, j] = [b - a, c - b];
      if (i > 300 && j > 300 && Math.abs(i - j) / Math.max(i, j) < 0.3) { fire('cadence'); taps = []; }
    }
  };
  on('pointerup', (e) => {
    stopHold();
    if (down && live() && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 12 && performance.now() - down.at < 400) tap(e.clientX, e.clientY);
    down = null;
  });
  on('pointercancel', () => { stopHold(); down = null; });

  // sections the visitor actually reads
  const visible = new Set<string>();
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    const task = SECTIONS[e.target.id];
    if (e.isIntersecting) { visible.add(task); fire(task); } else visible.delete(task);
  }), { threshold: 0.5 });
  Object.keys(SECTIONS).forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  off.push(() => io.disconnect());
  // a world that locks while its section is already on screen still counts
  const recheck = setInterval(() => { if (live()) { visible.forEach(fire); collect(); } }, 2000);
  off.push(() => clearInterval(recheck));

  // a round trip down the page and back
  let leg = 0;
  on('scroll', () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    if (scrollY < 50) { if (leg === 2) fire('day-cycle'); leg = 1; }
    else if (leg === 1 && scrollY > max - 80) leg = 2;
  }, { passive: true });

  // nobody touching anything
  let idle = performance.now();
  const wake = () => (idle = performance.now());
  (['pointerdown', 'pointermove', 'scroll', 'keydown', 'wheel', 'touchstart'] as const).forEach((t) => on(t as 'scroll', wake, { passive: true }));
  const quiet = setInterval(() => {
    if (document.visibilityState === 'visible' && performance.now() - idle > 25000) { idle = performance.now(); fire('silence'); }
  }, 1000);
  off.push(() => clearInterval(quiet));

  // night in the base's time zone
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(new Date()));
  if (hour >= 22 || hour < 5) fire('night');

  // a way to reach the author, and a hidden tap target
  let seedTaps: number[] = [];
  on('click', (e) => {
    const el = e.target as Element;
    if (el.closest('a[href^="mailto:"], a[href*="github.com"], a[href*="linkedin.com"]')) fire('contact');
    const a = el.closest('a');
    if (a && (a.protocol === 'mailto:' || a.hostname !== location.hostname)) {
      const kind = a.protocol === 'mailto:' ? 'email' : a.hostname.replace(/^www\./, '').split('.')[0];
      track('link_click', { kind, href: a.protocol === 'mailto:' ? 'mailto' : a.hostname + a.pathname, where: a.closest('section[id]')?.id ?? 'bar' });
    }
    if (el.closest('[data-seed]')) {
      const now = performance.now();
      seedTaps = [...seedTaps.filter((t) => now - t < 2000), now];
      if (seedTaps.length >= 3) { fire('logbook'); seedTaps = []; }
    }
  });

  return () => off.forEach((f) => f());
}
