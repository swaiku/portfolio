export interface Stage { x: number; y: number; s: number }

/** Reads `data-stage="x,y,scale"` off the page sections and reports which one the viewport is on. */
export function trackStages() {
  const target: Stage = { x: 0.5, y: 0, s: 0.9 };
  const state = { scroll: 0 };
  let sections: Element[] = [];

  const parse = (el: Element, mobile: boolean): Stage => {
    const raw = (mobile && el.getAttribute('data-stage-m')) || el.getAttribute('data-stage') || '0.5,0,1';
    const [x, y, s] = raw.split(',').map(Number);
    return { x, y, s };
  };

  const pick = () => {
    if (!sections.length) sections = Array.from(document.querySelectorAll('[data-stage]'));
    const mobile = innerWidth / innerHeight < 0.9 || innerWidth < 760;
    const mid = innerHeight * 0.55;
    let best = sections[0];
    for (const el of sections) {
      const r = el.getBoundingClientRect();
      if (r.top <= mid) best = el;
      if (r.top <= mid && r.bottom >= mid) { best = el; break; }
    }
    if (best) Object.assign(target, parse(best, mobile));
    const max = document.documentElement.scrollHeight - innerHeight;
    state.scroll = max > 0 ? scrollY / max : 0;
  };

  pick();
  addEventListener('scroll', pick, { passive: true });
  addEventListener('resize', pick);
  return { target, state, refresh: pick, dispose: () => { removeEventListener('scroll', pick); removeEventListener('resize', pick); } };
}
