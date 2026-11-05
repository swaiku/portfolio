export interface Stage { x: number; y: number; s: number }

/**
 * Reads `data-stage="x,y,scale"` off the window the body sits in (the home page lens). The pose is in page
 * coordinates: `state.shift` carries it along with the scroll, unsmoothed, so the body never drifts out of the window.
 * `state.scroll` is how far down the page the visitor is, from 0 to 1; it stays put under reduced motion.
 */
export function trackStages() {
  const target: Stage = { x: 0.5, y: 0, s: 0.9 };
  const state = { scroll: 0, shift: 0 };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const follow = () => {
    state.shift = (2 * scrollY) / innerHeight;
    if (!reduced) state.scroll = scrollY / Math.max(document.documentElement.scrollHeight - innerHeight, 1);
  };
  const read = () => {
    const raw = document.querySelector('[data-stage]')?.getAttribute('data-stage');
    if (raw) {
      const [x, y, s] = raw.split(',').map(Number);
      Object.assign(target, { x, y, s });
    }
    follow();
  };

  read();
  // the page re-aims the lens on resize, and its height changes when fonts land
  const observer = new ResizeObserver(read);
  observer.observe(document.documentElement);
  addEventListener('resize', read);
  addEventListener('scroll', follow, { passive: true });
  return {
    target,
    state,
    refresh: read,
    dispose: () => {
      observer.disconnect();
      removeEventListener('resize', read);
      removeEventListener('scroll', follow);
    },
  };
}
