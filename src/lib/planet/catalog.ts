// The classes of world and their templates: plain data, no three.js, so the HUD and the atlas load without the renderer
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
