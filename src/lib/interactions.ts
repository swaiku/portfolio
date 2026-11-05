import { sim } from './planet/sim.svelte';
import { track } from './track';

/** Where the bodies are on screen, in CSS pixels. The scene writes it every frame; the canvas itself never gets a pointer event. */
export const stage = { x: 0, y: 0, r: 0, cx: 0, cy: 0, cr: 0, binary: false, drag: 0 };

const IGNORE = 'a, button, input, dialog, summary';
const near = (px: number, py: number, x: number, y: number, r: number) => Math.hypot(px - x, py - y) <= Math.max(r, 36);
const onBody = (x: number, y: number) =>
  (stage.r > 0 && near(x, y, stage.x, stage.y, stage.r)) || (stage.binary && near(x, y, stage.cx, stage.cy, stage.cr));

/** A mouse can drag the world round; outbound links are counted. Returns the cleanup. */
export function startInteractions() {
  const off: (() => void)[] = [];
  const on = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
    addEventListener(type, fn as EventListener, opts);
    off.push(() => removeEventListener(type, fn as EventListener));
  };

  let dragging = false;
  let last = 0;
  on('pointerdown', (e) => {
    if (e.button !== 0 || e.pointerType !== 'mouse' || (e.target as Element)?.closest?.(IGNORE) || sim.state !== 'LOCKED') return;
    dragging = onBody(e.clientX, e.clientY);
    last = e.clientX;
  });
  on('pointermove', (e) => {
    if (!dragging || !(e.buttons & 1)) return;
    stage.drag += (e.clientX - last) * 0.006;
    document.body.style.userSelect = 'none';
    last = e.clientX;
  });
  const stop = () => { dragging = false; document.body.style.userSelect = ''; };
  on('pointerup', stop);
  on('pointercancel', stop);

  on('click', (e) => {
    const a = (e.target as Element).closest('a');
    if (a && (a.protocol === 'mailto:' || a.hostname !== location.hostname)) {
      const kind = a.protocol === 'mailto:' ? 'email' : a.hostname.replace(/^www\./, '').split('.')[0];
      track('link_click', { kind, href: a.protocol === 'mailto:' ? 'mailto' : a.hostname + a.pathname, where: a.closest('section[id]')?.id ?? 'sheet' });
    }
  });

  return () => off.forEach((f) => f());
}
