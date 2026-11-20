import { TYPES } from './planet/catalog';
import type { RollArgs } from './planet/archetypes';
import { track } from './track';

/** A line about each class, shown once it has been seen. */
export const CLASSES: Record<string, string> = {
  rocky: 'A rocky planet is a thin crust of silicate rock over a metal core.',
  gas: "Jupiter's bands are jet streams, carried round by a day of about ten hours.",
  moons: "A moon stays bound while it orbits inside its planet's Hill sphere.",
  star: "A star shines because its core fuses hydrogen into helium.",
  belt: 'An asteroid belt is material that never merged into a planet.',
  dead: 'With no air and no inner heat, nothing moves: no weather, no tectonics.',
  binary: 'Both stars orbit a shared centre of mass, the barycentre.',
  comet: 'A comet only grows a tail near a star, where its ice turns to gas.',
  pulsar: 'A pulsar is a spinning neutron star: its beam sweeps past like a lighthouse.',
  hole: 'Past the event horizon, nothing, light included, climbs back out.',
  titan: 'Rings sit inside the Roche limit, where tides tear apart anything trying to become a moon.',
  'twin-pulsar': 'Two pulsars in orbit shed gravitational waves and slowly spiral together.',
  crater: 'With no air or weather to wear them down, craters last for billions of years.',
  ocean: 'An ocean world has no shore: its sea can run hundreds of kilometres deep.',
  ice: "Under an ice world's shell, tides can keep an ocean liquid, as on Europa.",
  shroud: 'Venus hides under clouds of sulfuric acid; only radar sees its ground.',
  galaxy: 'A spiral arm is a wave of crowding that stars pass through, not a fixed set of stars.',
};

interface Save {
  /** the seed each class was first seen in */
  seen: Record<string, string>;
  /** a small picture of that first world, taken once it is on screen (a data URL) */
  thumbs: Record<string, string>;
  last?: RollArgs;
  opened?: boolean;
  /** when the world on screen finished baking; a reload inside the cooldown brings it back, after it rolls a new one */
  lockedAt?: number;
  /** how to rebuild the first world seen of each class, so the atlas can bring it back */
  args: Record<string, RollArgs>;
}

/** seconds a locked world stays before the next survey, or a reload, may replace it */
export const COOLDOWN = 8;
const KEY = 'swaiku:atlas:v1';
const EMPTY = (): Save => ({ seen: {}, thumbs: {}, args: {} });
// each picture has a key of its own: when storage is full, a picture fails to save, never the collection
const thumbKey = (id: string) => `${KEY}:thumb:${id}`;
const storeThumb = (id: string, url: string) => {
  try { localStorage.setItem(thumbKey(id), url); } catch { /* storage full: the atlas shows the class's mark */ }
};
const load = (): Save => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw && typeof raw === 'object') {
      if (raw.lockedAt && Date.now() - raw.lockedAt > COOLDOWN * 1000) delete raw.last;
      // an older save kept the pictures inline: move them out to their own keys
      Object.entries((raw.thumbs ?? {}) as Record<string, string>).forEach(([id, url]) => storeThumb(id, url));
      const thumbs: Record<string, string> = {};
      for (const { id } of TYPES) {
        const url = localStorage.getItem(thumbKey(id));
        if (url) thumbs[id] = url;
      }
      return { ...EMPTY(), ...raw, thumbs };
    }
  } catch { /* private mode or corrupt save: start fresh */ }
  return EMPTY();
};

export const atlas = $state({
  ...load(),
  current: { id: '', seed: '' },
  toast: null as { title: string; name: string; line: string } | null,
  fresh: '',
});

const save = () => {
  const { seen, last, args, opened, lockedAt } = atlas;
  try { localStorage.setItem(KEY, JSON.stringify({ seen, last, args, opened, lockedAt })); } catch { /* storage unavailable */ }
};

let toastTimer = 0;
const say = (title: string, name: string, line: string) => {
  atlas.toast = { title, name, line };
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (atlas.toast = null), 8000);
};
/** The toast waits while it is pointed at or focused, then leaves a moment after. */
export const holdToast = () => clearTimeout(toastTimer);
export const releaseToast = () => {
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (atlas.toast = null), 4000);
};
export const dismissToast = () => {
  clearTimeout(toastTimer);
  atlas.toast = null;
};

export const seenCount = () => Object.keys(atlas.seen).length;
const label = (id: string) => TYPES.find((t) => t.id === id)?.label ?? id;

/** The world on screen changed: note it, and remember how to bring it back after a reload. */
export const noteWorld = (id: string, seed: string, fresh: boolean, args: RollArgs, info: Record<string, string | number | boolean> = {}) => {
  if (fresh) track(args.kind ? 'world_tuned' : 'world_rolled', { class: id, ...info, seed, new: !atlas.seen[id] });
  atlas.current = { id, seed };
  atlas.last = args;
  atlas.lockedAt = 0;
  if (!atlas.seen[id]) {
    atlas.seen[id] = seed;
    atlas.args[id] = args;
    atlas.fresh = id;
    say('New class', label(id), CLASSES[id]);
    track('class_seen', { class: id, total: seenCount() });
    if (seenCount() === TYPES.length) track('atlas_complete');
  }
  save();
};

/** Tune the lens to a class: a new world of that class, whether it has been seen or not. */
export const tune = (id: string) => {
  track('class_tuned', { class: id });
  dispatchEvent(new CustomEvent('planet:reseed', { detail: { kind: id } }));
};

/** Bring back the world a class was first seen in. */
export const revisit = (id: string) => {
  const args = atlas.args[id];
  if (!args || atlas.current.seed === atlas.seen[id]) return false;
  track('atlas_revisit', { class: id });
  dispatchEvent(new CustomEvent('planet:reseed', { detail: { replay: args } }));
  return true;
};

/** Open the atlas; the first time also settles the invitation to look. */
export const openAtlas = () => {
  atlas.opened = true;
  track('atlas_opened', { seen: seenCount() });
  save();
  dispatchEvent(new Event('atlas:open'));
};

/** The atlas wants a picture of the world on screen: only the first world of a class, and only once. */
export const wantsThumb = () => {
  const { id, seed } = atlas.current;
  return !!id && atlas.seen[id] === seed && !atlas.thumbs[id];
};
export const keepThumb = (id: string, url: string) => {
  atlas.thumbs[id] = url;
  storeThumb(id, url);
};

/** The world finished baking: the cooldown starts now. */
export const markLocked = () => {
  atlas.lockedAt = Date.now();
  save();
};
