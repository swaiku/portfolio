import * as THREE from 'three';

/**
 * A colour with no hue: [saturation, lightness] in the renderer's working space. A world's palette decides the hue,
 * so a template only says how strong and how light each colour is.
 */
export type Tone = [number, number];

/** A world class: terrain character and the tonal structure of its palette. Hues are rolled per world. */
export interface Archetype {
  id: string;
  label: string;
  ramp: [Tone, Tone, Tone, Tone, Tone]; // low → high ground
  liquid?: { deep: Tone; shallow: Tone; level: number };
  gas?: { bands: number; swirl: number }; // a gas giant: banded, no ground, no relief
  strata: number;
  strataF: number;
  terrain: { cfreq: number; amp: number; ridge: number; warp: number; terrace: number; dry: boolean };
  ice?: { color: Tone; amount: number };
  cloud: { tint: Tone; amt: number };
  atmo: { power: number; tone: Tone; scatter: number };
  sun: Tone;
  glow?: { color: Tone; mode: 0 | 1; amt: number; day: number };
  sky: [Tone, Tone, Tone];
}

export const ARCHETYPES: Archetype[] = [
  {
    id: 'ember', label: 'Magma',
    ramp: [[0.48, 0.00], [0.66, 0.01], [0.81, 0.04], [0.89, 0.10], [0.92, 0.28]],
    strata: 0.15, strataF: 6,
    terrain: { cfreq: 1.5, amp: 0.3, ridge: 0.5, warp: 0.4, terrace: 0, dry: true },
    cloud: { tint: [0.30, 0.05], amt: 0.45 },
    atmo: { power: 46, tone: [1.00, 0.55], scatter: 0.55 }, sun: [1.00, 0.72],
    glow: { color: [1.00, 0.51], mode: 1, amt: 2.2, day: 0.4 },
    sky: [[0.86, 0.04], [0.77, 0.01], [0.92, 0.08]],
  },
  {
    id: 'saltglass', label: 'Salt flats',
    ramp: [[0.70, 0.28], [0.53, 0.45], [0.62, 0.66], [0.70, 0.74], [1.00, 0.87]],
    liquid: { deep: [0.97, 0.12], shallow: [0.94, 0.32], level: 0.02 },
    strata: 0.55, strataF: 5,
    terrain: { cfreq: 1.9, amp: 0.12, ridge: 0.05, warp: 0.15, terrace: 6, dry: false },
    cloud: { tint: [1.00, 0.88], amt: 0.6 },
    atmo: { power: 42, tone: [1.00, 0.73], scatter: 0.6 }, sun: [1.00, 0.90],
    sky: [[0.77, 0.04], [0.89, 0.08], [0.72, 0.08]],
  },
  {
    id: 'verdigris', label: 'Moss',
    ramp: [[0.79, 0.02], [0.91, 0.05], [0.93, 0.18], [0.52, 0.44], [0.76, 0.70]],
    liquid: { deep: [0.95, 0.06], shallow: [0.87, 0.40], level: 0.08 },
    strata: 0.2, strataF: 6,
    terrain: { cfreq: 1.1, amp: 0.3, ridge: 0.25, warp: 0.3, terrace: 0, dry: false },
    cloud: { tint: [1.00, 0.84], amt: 0.7 },
    atmo: { power: 32, tone: [1.00, 0.62], scatter: 0.6 }, sun: [1.00, 0.91],
    glow: { color: [1.00, 0.52], mode: 0, amt: 1.5, day: 0 },
    sky: [[0.84, 0.02], [0.92, 0.06], [0.92, 0.04]],
  },
  {
    id: 'cobalt', label: 'Dunes',
    ramp: [[0.89, 0.03], [0.97, 0.18], [0.93, 0.42], [1.00, 0.57], [1.00, 0.84]],
    strata: 0.35, strataF: 9,
    terrain: { cfreq: 1.3, amp: 0.14, ridge: 0.0, warp: 0.9, terrace: 0, dry: true },
    cloud: { tint: [0.00, 1.00], amt: 0.0 },
    atmo: { power: 50, tone: [1.00, 0.62], scatter: 0.7 }, sun: [1.00, 0.66],
    sky: [[0.92, 0.06], [0.88, 0.09], [0.96, 0.07]],
  },
  {
    id: 'sulfur', label: 'Strata',
    ramp: [[1.00, 0.02], [1.00, 0.13], [0.97, 0.30], [0.75, 0.46], [0.76, 0.68]],
    liquid: { deep: [0.94, 0.07], shallow: [1.00, 0.52], level: 0.06 },
    strata: 0.6, strataF: 7,
    terrain: { cfreq: 1.6, amp: 0.25, ridge: 0.4, warp: 0.2, terrace: 4, dry: false },
    cloud: { tint: [0.71, 0.62], amt: 0.55 },
    atmo: { power: 38, tone: [1.00, 0.58], scatter: 0.7 }, sun: [1.00, 0.79],
    sky: [[0.87, 0.02], [0.63, 0.01], [0.93, 0.04]],
  },
  {
    id: 'frostbloom', label: 'Frost',
    ramp: [[0.74, 0.09], [0.60, 0.36], [0.65, 0.63], [1.00, 0.86], [0.00, 1.00]],
    strata: 0.25, strataF: 5,
    terrain: { cfreq: 1.2, amp: 0.2, ridge: 0.3, warp: 0.25, terrace: 0, dry: true },
    ice: { color: [1.00, 0.93], amount: 0.55 },
    cloud: { tint: [1.00, 0.87], amt: 0.4 },
    atmo: { power: 48, tone: [1.00, 0.64], scatter: 0.55 }, sun: [1.00, 0.90],
    glow: { color: [1.00, 0.52], mode: 1, amt: 1.0, day: 0.3 },
    sky: [[0.87, 0.08], [0.92, 0.06], [0.95, 0.10]],
  },
  {
    id: 'orchid', label: 'Tidal',
    ramp: [[0.90, 0.05], [0.90, 0.30], [0.74, 0.51], [1.00, 0.72], [0.00, 1.00]],
    liquid: { deep: [0.94, 0.05], shallow: [0.83, 0.41], level: 0.24 },
    strata: 0.1, strataF: 6,
    terrain: { cfreq: 2.3, amp: 0.2, ridge: 0.12, warp: 0.2, terrace: 0, dry: false },
    cloud: { tint: [1.00, 0.82], amt: 0.85 },
    atmo: { power: 40, tone: [1.00, 0.65], scatter: 0.6 }, sun: [1.00, 0.90],
    sky: [[0.93, 0.04], [0.87, 0.08], [0.87, 0.08]],
  },
  {
    id: 'rust', label: 'Canyon',
    ramp: [[0.77, 0.01], [0.93, 0.10], [0.96, 0.30], [0.91, 0.46], [1.00, 0.63]],
    strata: 0.8, strataF: 11,
    terrain: { cfreq: 1.0, amp: 0.35, ridge: 0.6, warp: 0.35, terrace: 8, dry: true },
    cloud: { tint: [1.00, 0.74], amt: 0.15 },
    atmo: { power: 44, tone: [1.00, 0.57], scatter: 0.6 }, sun: [1.00, 0.84],
    sky: [[0.89, 0.02], [0.78, 0.02], [0.78, 0.02]],
  },
  {
    id: 'obsidian', label: 'Glass',
    ramp: [[0.23, 0.00], [0.39, 0.01], [0.54, 0.02], [0.55, 0.03], [0.59, 0.06]],
    strata: 0.3, strataF: 8,
    terrain: { cfreq: 1.4, amp: 0.28, ridge: 0.5, warp: 0.5, terrace: 0, dry: true },
    cloud: { tint: [1.00, 0.66], amt: 0.25 },
    atmo: { power: 40, tone: [1.00, 0.60], scatter: 0.5 }, sun: [1.00, 0.82],
    glow: { color: [1.00, 0.52], mode: 1, amt: 1.5, day: 0.9 },
    sky: [[0.78, 0.01], [0.89, 0.03], [0.87, 0.02]],
  },
  {
    id: 'jovian', label: 'Gas giant',
    gas: { bands: 7, swirl: 0.06 },
    ramp: [[0.5, 0.08], [0.55, 0.2], [0.45, 0.34], [0.4, 0.5], [0.3, 0.72]],
    strata: 0, strataF: 6,
    terrain: { cfreq: 1, amp: 0, ridge: 0, warp: 0, terrace: 0, dry: true },
    cloud: { tint: [0.2, 0.8], amt: 0 },
    atmo: { power: 30, tone: [0.6, 0.5], scatter: 0.65 }, sun: [0.3, 0.9],
    sky: [[0.8, 0.04], [0.7, 0.03], [0.8, 0.05]],
  },
  {
    id: 'ammonia', label: 'Pale giant',
    gas: { bands: 4.5, swirl: 0.03 },
    ramp: [[0.25, 0.3], [0.28, 0.4], [0.3, 0.5], [0.3, 0.62], [0.22, 0.78]],
    strata: 0, strataF: 6,
    terrain: { cfreq: 1, amp: 0, ridge: 0, warp: 0, terrace: 0, dry: true },
    cloud: { tint: [0.2, 0.8], amt: 0 },
    atmo: { power: 26, tone: [0.5, 0.55], scatter: 0.75 }, sun: [0.2, 0.92],
    sky: [[0.7, 0.04], [0.6, 0.04], [0.7, 0.05]],
  },
  {
    id: 'tempest', label: 'Storm giant',
    gas: { bands: 13, swirl: 0.11 },
    ramp: [[0.7, 0.03], [0.65, 0.12], [0.6, 0.26], [0.5, 0.44], [0.4, 0.66]],
    strata: 0, strataF: 6,
    terrain: { cfreq: 1, amp: 0, ridge: 0, warp: 0, terrace: 0, dry: true },
    cloud: { tint: [0.2, 0.8], amt: 0 },
    atmo: { power: 36, tone: [0.7, 0.45], scatter: 0.6 }, sun: [0.35, 0.88],
    sky: [[0.9, 0.04], [0.8, 0.03], [0.9, 0.05]],
  },
  {
    id: 'cinder', label: 'Dead world',
    ramp: [[0.3, 0.015], [0.32, 0.04], [0.3, 0.09], [0.25, 0.17], [0.2, 0.3]],
    strata: 0.3, strataF: 9,
    terrain: { cfreq: 1.7, amp: 0.3, ridge: 0.65, warp: 0.5, terrace: 0, dry: true },
    cloud: { tint: [0.1, 0.4], amt: 0 },
    atmo: { power: 4, tone: [0.5, 0.4], scatter: 0.2 }, sun: [0.25, 0.85],
    glow: { color: [1, 0.5], mode: 1, amt: 2.1, day: 0.85 },
    sky: [[0.6, 0.02], [0.5, 0.015], [0.6, 0.025]],
  },
];

/** Anything with a colour identity: planet archetypes, stars and black holes share this. */
export interface Template {
  id: string;
  label: string;
  ramp: [Tone, Tone, Tone, Tone, Tone];
  sky: [Tone, Tone, Tone];
}

export const STARS: Template[] = [
  { id: 'dwarf', label: 'Dwarf star', ramp: [[1.00, 0.01], [1.00, 0.05], [0.99, 0.23], [1.00, 0.51], [1.00, 0.61]], sky: [[1.00, 0.02], [0.79, 0.01], [0.93, 0.04]] },
  { id: 'main', label: 'Main-sequence star', ramp: [[1.00, 0.02], [1.00, 0.20], [1.00, 0.50], [1.00, 0.56], [1.00, 0.82]], sky: [[1.00, 0.02], [0.82, 0.03], [0.93, 0.04]] },
  { id: 'giant', label: 'Giant star', ramp: [[0.93, 0.04], [0.95, 0.27], [1.00, 0.55], [1.00, 0.74], [0.00, 1.00]], sky: [[0.95, 0.06], [0.88, 0.09], [0.96, 0.07]] },
  { id: 'magnetar', label: 'Magnetar', ramp: [[1.00, 0.03], [0.97, 0.18], [1.00, 0.53], [1.00, 0.64], [1.00, 0.90]], sky: [[0.95, 0.06], [0.93, 0.04], [0.92, 0.06]] },
  { id: 'pulsar', label: 'Pulsar', ramp: [[1.00, 0.01], [1.00, 0.06], [0.96, 0.32], [1.00, 0.68], [1.00, 0.94]], sky: [[0.88, 0.02], [0.89, 0.03], [0.92, 0.04]] },
];

export const HOLES: Template[] = [
  { id: 'quasar', label: 'Black hole', ramp: [[1.00, 0.01], [1.00, 0.13], [1.00, 0.50], [1.00, 0.56], [0.00, 1.00]], sky: [[0.82, 0.03], [0.82, 0.03], [0.89, 0.03]] },
  { id: 'cold', label: 'Black hole', ramp: [[1.00, 0.01], [0.98, 0.13], [1.00, 0.51], [1.00, 0.68], [0.00, 1.00]], sky: [[0.93, 0.04], [0.92, 0.06], [0.94, 0.05]] },
  { id: 'singularity', label: 'Singularity', ramp: [[1.00, 0.01], [0.95, 0.11], [1.00, 0.53], [1.00, 0.68], [0.00, 1.00]], sky: [[0.93, 0.04], [0.86, 0.04], [0.88, 0.04]] },
];

export const NEBULAE: Template[] = [
  { id: 'nebula', label: 'Nebula', ramp: [[0.6, 0.02], [0.7, 0.1], [0.75, 0.22], [0.8, 0.4], [0.5, 0.8]], sky: [[0.8, 0.05], [0.7, 0.05], [0.8, 0.06]] },
];

export const COMETS: Template[] = [
  { id: 'comet', label: 'Comet', ramp: [[0.2, 0.1], [0.2, 0.25], [0.2, 0.45], [0.5, 0.65], [0.2, 0.92]], sky: [[0.7, 0.03], [0.6, 0.03], [0.7, 0.04]] },
];

/** The forms a nebula can take; the shader paints each one. */
export const NEBULA_SHAPES = ['emission cloud', 'planetary shell', 'supernova bubble', 'bipolar', 'pillars', 'veil'] as const;

export type Kind = 'planet' | 'star' | 'hole' | 'nebula' | 'comet';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** A kind of celestial object and how often it turns up. `weight` is its share of rolls, in percent. */
export interface ObjectType {
  id: string;
  label: string;
  rarity: Rarity;
  weight: number;
  family: Kind;
  pool: string[]; // template ids this type may use
  moons?: [number, number]; // how many moons, min and max
  belt?: boolean;
  binary?: boolean; // a companion star
  jets?: boolean; // twin beams along the axis
  ring?: boolean; // always ringed
}

const ROCKY = ARCHETYPES.filter((a) => !a.gas && a.id !== 'cinder').map((a) => a.id);
const GAS = ARCHETYPES.filter((a) => a.gas).map((a) => a.id);

export const TYPES: ObjectType[] = [
  { id: 'rocky', label: 'Rocky planet', rarity: 'common', weight: 37.5, family: 'planet', pool: ROCKY },
  { id: 'gas', label: 'Gas giant', rarity: 'common', weight: 24, family: 'planet', pool: GAS },
  { id: 'moons', label: 'Planet with moons', rarity: 'uncommon', weight: 13, family: 'planet', pool: [...ROCKY, ...GAS], moons: [1, 3] },
  { id: 'star', label: 'Star', rarity: 'uncommon', weight: 10, family: 'star', pool: ['dwarf', 'main', 'giant'] },
  { id: 'belt', label: 'Asteroid belt', rarity: 'uncommon', weight: 6, family: 'planet', pool: [...ROCKY, 'cinder'], belt: true },
  { id: 'dead', label: 'Dead world', rarity: 'rare', weight: 3.5, family: 'planet', pool: ['cinder'] },
  { id: 'binary', label: 'Binary star', rarity: 'rare', weight: 2.5, family: 'star', pool: ['dwarf', 'main', 'giant'], binary: true },
  { id: 'comet', label: 'Comet', rarity: 'rare', weight: 1.5, family: 'comet', pool: ['comet'] },
  { id: 'pulsar', label: 'Pulsar', rarity: 'epic', weight: 1, family: 'star', pool: ['magnetar', 'pulsar'], jets: true },
  { id: 'hole', label: 'Black hole', rarity: 'epic', weight: 0.5, family: 'hole', pool: ['quasar', 'cold', 'singularity'] },
  { id: 'titan', label: 'Titan', rarity: 'legendary', weight: 0.25, family: 'planet', pool: ['jovian'], moons: [3, 3], ring: true },
  { id: 'twin-pulsar', label: 'Twin pulsar', rarity: 'legendary', weight: 0.25, family: 'star', pool: ['magnetar', 'pulsar'], binary: true, jets: true },
];

/** The second star of a binary: its mass ratio to the primary, how far apart they are, and what it looks like. */
export interface Companion {
  q: number; // mass relative to the primary, 0.3 to 1
  d: number; // separation, in primary radii
  tpl: Template;
  role: number; // which scheme hue colours it, so it need not match the primary
  phase: number;
  incline: number;
  period: number; // its own spin, for a pulsar companion
  tilt: number;
}

export interface Moon {
  size: number; // radius, as a share of the planet's
  orbit: number; // distance from the centre, in planet radii
  speed: number; // radians per second
  phase: number;
  incline: number;
  role: number; // which scheme hue it takes
  tone: Tone; // [saturation, lightness] of its surface
  style: number; // 0 cratered rock, 1 smooth ice, 2 mottled and dark
  seed: number;
}

export interface RingSpec {
  inner: number;
  outer: number;
  amount: number;
  f1: number;
  f2: number;
  gaps: [number, number][]; // [position 0..1 across the ring, half-width]
  a: string;
  b: string;
}

export interface World {
  seed: number;
  name: string;
  kind: Kind;
  type: ObjectType;
  tpl: Template;
  arch: Archetype | null; // planet-only parameters
  moons: Moon[];
  belt: { inner: number; outer: number; seed: number } | null;
  terrainSeed: THREE.Vector3;
  hue: number; // base hue of the rolled palette
  scheme: number[]; // three hues the palette draws from, one per role (see Role)
  sat: number; // saturation drift
  drift: number; // hue change per ramp step, so the ground shades toward a neighbouring hue
  ring: RingSpec | null;
  tilt: [number, number]; // axis tilt toward the camera / roll
  activity: number; // star storms
  size: number; // overall scale, rolled last so older seeds keep their other traits
  spots: number; // stars: how many near-black sunspots
  storms: number; // stars: how violent the flares and eruptions
  beamTilt: number; // pulsars: angle between the beams' axis and the spin axis
  companion: Companion | null;
  nebula: number; // nebulae: which shape, see NEBULA_SHAPES
  period: number; // pulsars: real rotation period in seconds, 1.4 ms to 75.9 s like the known extremes
  accent: string;
}

export const mulberry = (a: number) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const A = ['Ka', 'Ve', 'Or', 'Thi', 'Zan', 'Mi', 'Lu', 'Ex', 'Syr', 'Dra', 'Quo', 'Nel', 'Ahr', 'Bo', 'Yss', 'Tor', 'Ina', 'Pel'];
const B = ['th', 'r', 'n', 'l', 'x', 'v', 'sh', 'm', 'z'];
const C = ['a', 'e', 'o', 'u', 'ia', 'ei', 'ar', 'un', 'es', 'is'];
const ROMAN = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'IX'];

const hsl = (h: number, s: number, l: number) => '#' + new THREE.Color().setHSL(((h % 1) + 1) % 1, s, l, THREE.SRGBColorSpace).getHexString(THREE.SRGBColorSpace);

function rollRing(r: () => number, h: number): RingSpec {
  const inner = 1.22 + r() * 0.45;
  // rings live inside the Roche limit (about 2.4 planet radii): beyond it tides cannot stop the debris from clumping into moons
  const outer = Math.min(inner + 0.18 + r() * r() * 1.1 + r() * 0.25, 2.45);
  const gaps: [number, number][] = [];
  for (let i = Math.floor(r() * 3.4); i > 0; i--) gaps.push([0.08 + r() * 0.84, 0.008 + r() * 0.05]);
  return {
    inner, outer, gaps,
    amount: 0.5 + r() * 0.5,
    f1: 18 + r() * 60,
    f2: 80 + r() * 200,
    a: hsl(h, 0.15 + r() * 0.55, 0.6 + r() * 0.22),
    b: hsl(h + (r() - 0.5) * 0.18, 0.25 + r() * 0.45, 0.32 + r() * 0.2),
  };
}

const TEMPLATES: Template[] = [...ARCHETYPES, ...STARS, ...HOLES, ...NEBULAE, ...COMETS];

const pulsarPeriod = (klass: number, spread: number) =>
  Math.pow(10, klass < 0.12 ? -2.85 + spread * 0.85 : klass < 0.97 ? -1 + spread * 1.5 : 0.5 + spread * 1.38);

/** `kind` forces a type id, a family ('planet', 'star', 'hole', ...) or one template id; `avoid` keeps a reroll from repeating its template. */
export function rollWorld(seed: number, kind?: string, avoid?: string, avoidHue?: number): World {
  const r = mulberry(seed);
  const weighted = (list: ObjectType[]) => {
    let k = r() * list.reduce((n, t) => n + t.weight, 0);
    return list.find((t) => (k -= t.weight) < 0) ?? list[list.length - 1];
  };
  const forcedTpl = kind ? TEMPLATES.find((t) => t.id === kind) : undefined;
  const type = TYPES.find((t) => t.id === kind)
    ?? (forcedTpl ? TYPES.find((t) => t.pool.includes(forcedTpl.id)) : undefined)
    ?? weighted(TYPES.filter((t) => !kind || t.family === kind).length ? TYPES.filter((t) => !kind || t.family === kind) : TYPES);
  const family = type.family;

  let candidates = type.pool;
  if (!forcedTpl && avoid && candidates.length > 1) candidates = candidates.filter((id) => id !== avoid);
  const tplId = candidates[Math.floor(r() * candidates.length)];
  const tpl = forcedTpl ?? TEMPLATES.find((t) => t.id === tplId)!;
  const arch = family === 'planet' ? (tpl as Archetype) : null;

  const pick = <T,>(x: T[]) => x[Math.floor(r() * x.length)];
  const base = `${pick(A)}${pick(B)}${pick(C)}`;
  const name = family === 'hole' ? base : `${base} ${pick(ROMAN)}`;
  const terrainSeed = new THREE.Vector3(r() * 40, r() * 40, r() * 40);
  // the palette is rolled from scratch: a template only says how strong and how light each colour is, never its hue.
  // A reroll lands at least 0.15 of the wheel away from the last one.
  let hue = r();
  if (avoidHue !== undefined) {
    const gap = ((((hue - avoidHue) % 1) + 1.5) % 1) - 0.5;
    if (Math.abs(gap) < 0.15) hue = (hue + (gap < 0 ? -0.15 : 0.15) - gap + 2) % 1;
  }
  const kindRoll = r();
  const scheme = kindRoll < 0.2 ? [hue, hue + 0.07, hue - 0.07]
    : kindRoll < 0.4 ? [hue, hue + 0.5, hue + 0.5 + (r() - 0.5) * 0.1]
    : kindRoll < 0.6 ? [hue, hue + 1 / 3, hue + 2 / 3]
    : kindRoll < 0.75 ? [hue, hue + 0.42, hue + 0.58]
    : [hue, r(), r()];
  if (r() < 0.5) [scheme[1], scheme[2]] = [scheme[2], scheme[1]];
  const sat = (r() - 0.5) * 0.5;
  const drift = (r() - 0.5) * 0.12;
  const ring = family === 'planet' && !type.belt && (type.ring || r() < (arch?.gas ? 0.6 : 0.42)) ? rollRing(r, pick(scheme)) : null;
  const tilt: [number, number] = family === 'hole'
    ? [0.05 + r() * 0.13, (r() - 0.5) * 0.6]
    : [0.1 + r() * 0.5, (r() - 0.5) * 1.5];
  const activity = 0.4 + r() * 0.6;
  const size = 0.84 + r() * 0.3;
  // a pulsar spins far too fast for spots or storms to read as anything but flicker, so its surface stays calm
  const spots = r() < 0.4 ? 0.45 + r() * 0.55 : r() * 0.3;
  const storms = r() < 0.3 ? 0.5 + r() * 0.5 : r() * 0.15;
  const beamTilt = 0.45 + r() * 0.7;
  // log-uniform inside each class: a few millisecond pulsars (fastest known, PSR J1748-2446ad: 1.4 ms), mostly ordinary
  // ones around a second, and the odd very slow one (slowest known, PSR J0901-4046: 75.9 s)
  const nebula = Math.floor(r() * NEBULA_SHAPES.length);
  const klass = r();
  const spread = r();
  const period = pulsarPeriod(klass, spread);
  let companion: Companion | null = null;
  if (type.binary) {
    // twin pulsars are two neutron stars of about the same mass; ordinary binaries pair unequal stars
    const q = type.jets ? 0.75 + r() * 0.25 : 0.3 + r() * 0.7;
    const cid = type.pool[Math.floor(r() * type.pool.length)];
    const ctpl = TEMPLATES.find((t) => t.id === cid)!;
    companion = {
      q, tpl: ctpl, d: 3 + r() * 0.8, role: 1 + Math.floor(r() * 2), phase: r() * Math.PI * 2, incline: (r() - 0.5) * 0.5,
      period: pulsarPeriod(r(), r()), tilt: 0.45 + r() * 0.7,
    };
  }
  const moons: Moon[] = [];
  if (type.moons) {
    const n = type.moons[0] + Math.floor(r() * (type.moons[1] - type.moons[0] + 1));
    // Ring gaps have two real causes, so a ringed world's gaps are rebuilt from its moons:
    //  - a moonlet orbiting inside the gap clears it (Pan in the Encke gap): it sits in the ring plane, gap a few times its size;
    //  - a larger moon further out empties the orbits that circle exactly 2 or 3 times for each of its own (Mimas and the Cassini
    //    division): period ratio p:1 puts the gap at a_moon * p^(-2/3), with nothing in it.
    // Everything else orbits beyond the ring edge, near the equatorial plane like the regular moons of the real giants.
    const gaps: [number, number][] = [];
    const width = ring ? ring.outer - ring.inner : 0;
    const shepherds = ring ? Math.min(n, 2) : 0;
    let outer = ring ? ring.outer + 0.3 : 1.55;
    for (let i = 0; i < n; i++) {
      const style = Math.floor(r() * 3);
      const common = {
        role: Math.floor(r() * 3), style, seed: r() * 40,
        tone: [style === 1 ? 0.1 + r() * 0.2 : 0.15 + r() * 0.5, style === 1 ? 0.55 + r() * 0.3 : style === 2 ? 0.08 + r() * 0.12 : 0.18 + r() * 0.3] as Tone,
        phase: r() * Math.PI * 2,
      };
      if (ring && i < shepherds) {
        const size = 0.02 + r() * 0.03;
        let k = 0.15 + r() * 0.7;
        for (let tries = 0; tries < 6 && gaps.some((g) => Math.abs(g[0] - k) < 0.12); tries++) k = 0.15 + r() * 0.7;
        gaps.push([k, Math.min(0.07, Math.max(0.015, (size * 2.2) / width))]);
        const orbit = ring.inner + k * width;
        moons.push({ ...common, size, orbit, speed: 0.5 / Math.pow(orbit, 1.5), incline: 0 });
      } else {
        const size = 0.035 + r() * r() * 0.11;
        outer += 0.3 + r() * 0.45;
        if (ring) {
          for (const p of [2, 3]) {
            const k = (outer * Math.pow(p, -2 / 3) - ring.inner) / width;
            if (k > 0.06 && k < 0.94 && gaps.length < 3 && !gaps.some((g) => Math.abs(g[0] - k) < 0.06)) gaps.push([k, 0.012 + size * 0.3]);
          }
        }
        const tilt = ring || r() < 0.85 ? (r() - 0.5) * (ring ? 0.1 : 0.24) : (r() - 0.5) * 1.1; // now and then a captured moon on a steep orbit
        moons.push({ ...common, size, orbit: outer, speed: (0.5 + r() * 0.5) * 0.5 / Math.pow(outer, 1.5), incline: tilt });
      }
    }
    if (ring) ring.gaps = gaps.slice(0, 3);
  }
  const inner = 1.7 + r() * 0.5;
  const belt = type.belt ? { inner, outer: inner + 0.5 + r() * 0.7, seed: Math.floor(r() * 1e6) } : null;

  // UI accent follows the rolled palette; bright enough to read on the dark page
  const accent = hsl(hue, 0.8, 0.62);

  return { seed, name, kind: family, type, tpl, arch, moons, belt, terrainSeed, hue, scheme, sat, drift, ring, tilt, activity, size, companion, nebula, period, spots: type.jets ? 0 : spots, storms: type.jets ? 0 : storms, beamTilt, accent };
}

/** Which of the world's scheme hues a colour takes. */
export const Role = { ground: 0, liquid: 1, air: 2 } as const;

/** Gives a hueless template tone its colour in this world: the role picks the hue, `step` walks it along the ramp. */
export const paint = (w: Pick<World, 'sat' | 'scheme' | 'drift'>) => (role: number, tone: Tone, step = 0): THREE.Vector3 => {
  const c = new THREE.Color();
  c.setHSL(((w.scheme[role] + step * w.drift) % 1 + 1) % 1, Math.max(0, Math.min(1, tone[0] * (1 + w.sat))), tone[1]);
  return new THREE.Vector3(c.r, c.g, c.b);
};

export const randomSeed = () => Math.floor(Math.random() * 0xffffff);

/**
 * How fast to turn a pulsar on screen, rad/s. A real 1.4 ms pulsar would turn 716 times a second, far past what a display
 * can show (it would strobe), so the real period is compressed onto 0.9 to 0.04 turns a second by its logarithm: faster
 * pulsars still turn faster, and a beam never sweeps past more than about twice a second.
 */
export const pulsarSpin = (period: number) => {
  const t = Math.min(1, Math.max(0, (Math.log10(period) + 2.85) / 4.73));
  return Math.PI * 2 * (0.9 - 0.86 * t);
};
