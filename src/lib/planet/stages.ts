import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export interface Stage { x: number; y: number; s: number }

/**
 * Reads `data-stage="x,y,scale"` off the page sections and scrubs the pose between them with the scroll position.
 *
 * The pose eases from one section to the next across the whole scroll gap between them, so the body glides along with
 * the page instead of snapping to a new target when a section crosses the viewport. `scrub` adds a catch-up, which also
 * smooths out the steps of a mouse wheel.
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
    // the size may change while the body sits beside the text, never when it is centred: a centred pose keeps the previous size
    for (let i = 1; i < poses.length; i++) if (Math.abs(poses[i].x) < 0.1) poses[i].s = poses[i - 1].s;

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
      defaults: { ease: 'sine.inOut' },
      scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 1.8, invalidateOnRefresh: true },
    });
    timeline.to(state, { scroll: 1, ease: 'none', duration: 1 }, 0);
    for (let i = 0; i < sections.length - 1; i++) {
      const gap = at[i + 1] - at[i];
      if (gap <= 0) continue;
      // travel across nearly the whole gap with a gentle ease, so there is always something moving gently and nothing snaps
      timeline.to(target, { ...poses[i + 1], ease: 'sine.inOut', duration: gap * 0.92 }, at[i] + gap * 0.04);
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
