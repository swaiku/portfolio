import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export interface Stage { x: number; y: number; s: number }

/**
 * Reads `data-stage="x,y,scale"` off the page sections and scrubs the pose between them with the scroll position.
 *
 * Each section holds its pose through the middle of its scroll range and eases into the next one in the gap, so the body
 * glides along with the page instead of snapping to a new target when a section crosses the viewport. `scrub` adds a
 * short catch-up, which also smooths out the steps of a mouse wheel.
 */
export function trackStages() {
  const target: Stage = { x: 0.5, y: 0, s: 0.9 };
  const state = { scroll: 0 };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timeline: gsap.core.Timeline | undefined;

  const parse = (el: Element, mobile: boolean): Stage => {
    const raw = (mobile && el.getAttribute('data-stage-m')) || el.getAttribute('data-stage') || '0.5,0,1';
    const [x, y, s] = raw.split(',').map(Number);
    return { x, y, s };
  };

  const build = () => {
    timeline?.scrollTrigger?.kill();
    timeline?.kill();
    const sections = Array.from(document.querySelectorAll('[data-stage]'));
    if (!sections.length) return;
    const mobile = innerWidth / innerHeight < 0.9 || innerWidth < 760;
    const max = Math.max(document.documentElement.scrollHeight - innerHeight, 1);

    // scroll offset at which each section is centred in the viewport, as a fraction of the whole page
    const at = sections.map((el) => {
      const r = el.getBoundingClientRect();
      return Math.min(Math.max((r.top + scrollY + r.height / 2 - innerHeight / 2) / max, 0), 1);
    });
    const poses = sections.map((el) => parse(el, mobile));

    Object.assign(target, poses[0]);
    state.scroll = 0;
    if (reduced) {
      state.scroll = scrollY / max;
      const mid = innerHeight * 0.55;
      const i = sections.findIndex((el) => el.getBoundingClientRect().bottom >= mid);
      Object.assign(target, poses[Math.max(i, 0)]);
      return;
    }

    timeline = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 1.1, invalidateOnRefresh: true },
    });
    timeline.to(state, { scroll: 1, ease: 'none', duration: 1 }, 0);
    for (let i = 0; i < sections.length - 1; i++) {
      const gap = at[i + 1] - at[i];
      if (gap <= 0) continue;
      // hold the first quarter of the gap, travel over the middle half, settle in the last quarter
      timeline.to(target, { ...poses[i + 1], duration: gap * 0.6 }, at[i] + gap * 0.2);
    }
    timeline.set({}, {}, 1); // pad to the full page so positions are scroll fractions
  };

  let resizeTimer: number | undefined;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => { build(); ScrollTrigger.refresh(); }, 150);
  };

  build();
  // page height changes when fonts or images land as well as on resize; section offsets are baked into the timeline
  const observer = new ResizeObserver(onResize);
  observer.observe(document.documentElement);
  addEventListener('resize', onResize);
  return {
    target,
    state,
    refresh: build,
    dispose: () => {
      observer.disconnect();
      removeEventListener('resize', onResize);
      clearTimeout(resizeTimer);
      timeline?.scrollTrigger?.kill();
      timeline?.kill();
    },
  };
}
