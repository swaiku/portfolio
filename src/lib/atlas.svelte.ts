import { TYPES, type RollArgs } from './planet/archetypes';
import { sim } from './planet/sim.svelte';

/** What a class asks of the visitor. `hint` shows once it has been observed, `note` once it is logged. */
export const CLASSES: Record<string, { hint: string; note: string }> = {
  rocky: { hint: 'Go to the bottom of the page, then back to the top.', note: 'A rocky planet is a thin crust of silicate rock over a metal core.' },
  gas: { hint: 'Stir it: tap the planet, quickly.', note: "Jupiter's bands are jet streams, carried round by a day of about ten hours." },
  moons: { hint: 'Visit the payload bay.', note: "A moon stays bound while it orbits inside its planet's Hill sphere." },
  star: { hint: 'Visit the active missions.', note: "A star shines because its core fuses hydrogen into helium." },
  belt: { hint: 'Visit the off-duty hours.', note: 'An asteroid belt is material that never merged into a planet.' },
  dead: { hint: 'Say nothing. Wait.', note: 'With no air and no inner heat, nothing moves: no weather, no tectonics.' },
  binary: { hint: 'Tap both stars, one after the other.', note: 'Both stars orbit a shared centre of mass, the barycentre.' },
  comet: { hint: 'Catch it.', note: 'A comet only grows a tail near a star, where its ice turns to gas.' },
  pulsar: { hint: 'Tap with a steady beat.', note: 'A pulsar is a spinning neutron star: its beam sweeps past like a lighthouse.' },
  hole: { hint: 'Hold on to it. Do not let go.', note: 'Past the event horizon, nothing, light included, climbs back out.' },
  titan: { hint: 'Log every common and uncommon class, then meet a Titan.', note: 'Rings sit inside the Roche limit, where tides tear apart anything trying to become a moon.' },
  'twin-pulsar': { hint: 'Log a pulsar and a binary star, then meet a twin pulsar.', note: 'Two pulsars in orbit shed gravitational waves and slowly spiral together.' },
};

/** Tasks the visitor can do. Each logs the class it is tied to if that world is on screen; `probe` ones also pay out once. */
export const TASKS: Record<string, { label: string; type?: string; probe: boolean; hidden?: boolean }> = {
  'day-cycle': { label: 'Day cycle', type: 'rocky', probe: true },
  payload: { label: 'Payload check', type: 'moons', probe: true },
  missions: { label: 'Ignition', type: 'star', probe: true },
  'off-duty': { label: 'Debris field', type: 'belt', probe: true },
  silence: { label: 'Silence', type: 'dead', probe: true, hidden: true },
  night: { label: 'Night shift', probe: true, hidden: true },
  contact: { label: 'First contact', probe: true, hidden: true },
  logbook: { label: 'Logbook', probe: true, hidden: true },
  stir: { label: 'Stir', type: 'gas', probe: false },
  cadence: { label: 'Cadence', type: 'pulsar', probe: false },
  accretion: { label: 'Accretion', type: 'hole', probe: false },
  barycentre: { label: 'Barycentre', type: 'binary', probe: false },
  catch: { label: 'Catch', type: 'comet', probe: false },
};

export const TASK_HINTS: Record<string, string> = {
  'day-cycle': 'Round trip, top to bottom.',
  payload: 'Visit the payload bay.',
  missions: 'Visit the active missions.',
  'off-duty': 'Visit the off-duty hours.',
};

interface Save {
  seen: Record<string, string>;
  logged: Record<string, { seed: string; at: number }>;
  tasks: Record<string, number>;
  probes: number;
  misses: number;
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
const EMPTY = (): Save => ({ seen: {}, logged: {}, tasks: {}, probes: 0, misses: 0, args: {} });
const load = (): Save => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw && typeof raw === 'object') {
      if (raw.lockedAt && Date.now() - raw.lockedAt > COOLDOWN * 1000) delete raw.last;
      return { ...EMPTY(), ...raw };
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
  const { seen, logged, tasks, probes, misses, last, args, opened, lockedAt } = atlas;
  try { localStorage.setItem(KEY, JSON.stringify({ seen, logged, tasks, probes, misses, last, args, opened, lockedAt })); } catch { /* storage unavailable */ }
};

let toastTimer = 0;
const say = (title: string, name: string, line: string) => {
  atlas.toast = { title, name, line };
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (atlas.toast = null), 8000);
};
export const dismissToast = () => {
  clearTimeout(toastTimer);
  atlas.toast = null;
};

export const loggedCount = () => Object.keys(atlas.logged).length;
const label = (id: string) => TYPES.find((t) => t.id === id)?.label ?? id;

const log = (id: string) => {
  if (atlas.logged[id]) return;
  atlas.logged[id] = { seed: atlas.current.id === id ? atlas.current.seed : (atlas.seen[id] ?? ''), at: Date.now() };
  atlas.fresh = id;
  say('Class logged', label(id), CLASSES[id].note);
  collect();
  save();
};

/** The legendary classes ask for the rest of the collection first, then to be met on screen. */
const NEEDS: Record<string, string[]> = { titan: ['rocky', 'gas', 'moons', 'star', 'belt'], 'twin-pulsar': ['pulsar', 'binary'] };
const earned = (id: string) => NEEDS[id]?.every((k) => atlas.logged[k]);

/** Logs a legendary class when its collection is done and that world is on screen. */
export const collect = () => {
  for (const id of Object.keys(NEEDS)) if (earned(id) && atlas.current.id === id && sim.state === 'LOCKED') log(id);
};

/** The world on screen changed: note it, and remember how to bring it back after a reload. */
export const noteWorld = (id: string, seed: string, fresh: boolean, args: RollArgs) => {
  atlas.current = { id, seed };
  atlas.last = args;
  atlas.lockedAt = 0;
  if (!atlas.seen[id]) {
    atlas.seen[id] = seed;
    atlas.args[id] = args;
    if (fresh) atlas.misses = 0;
  } else if (fresh) atlas.misses++;
  save();
};

/** Something the visitor did. Pays a probe the first time, and logs the task's class when that world is the one on screen. */
export const fire = (task: string) => {
  const def = TASKS[task];
  if (!def) return;
  if (!atlas.tasks[task]) {
    atlas.tasks[task] = Date.now();
    if (def.probe) {
      atlas.probes++;
      say('Probe recovered', def.label, 'Launch it from the atlas: the next survey goes to a random class you have not logged.');
    }
  }
  if (def.type && atlas.current.id === def.type && sim.state === 'LOCKED') log(def.type);
  save();
};

/** Odds tilted toward classes not yet seen, more the longer a run of rolls has found nothing new. */
export const boost = (): Record<string, number> => {
  const k = 1 + Math.min(atlas.misses, 30) * 0.5;
  return Object.fromEntries(TYPES.filter((t) => !atlas.seen[t.id]).map((t) => [t.id, k]));
};

/** A probe points at a class not logged yet; a legendary one only once its collection is done. */
export const probeTargets = () => TYPES.filter((t) => !atlas.logged[t.id] && (t.rarity !== 'legendary' || earned(t.id)));

export const launchProbe = () => {
  const pool = probeTargets();
  if (!atlas.probes || !pool.length) return false;
  atlas.probes--;
  save();
  dispatchEvent(new CustomEvent('planet:reseed', { detail: { kind: pool[Math.floor(Math.random() * pool.length)].id } }));
  return true;
};

/** Bring back the world a class was first seen in. Revisiting changes nothing about the odds. */
export const revisit = (id: string) => {
  const args = atlas.args[id];
  if (!args || atlas.current.seed === atlas.seen[id]) return false;
  dispatchEvent(new CustomEvent('planet:reseed', { detail: { replay: args } }));
  return true;
};

/** Open the atlas; the first time also settles the invitation to look. */
export const openAtlas = () => {
  atlas.opened = true;
  save();
  dispatchEvent(new Event('atlas:open'));
};

/** The world finished baking: the cooldown starts now. */
export const markLocked = () => {
  atlas.lockedAt = Date.now();
  save();
};
