import * as THREE from 'three';

/** A world class: palette, terrain character, sky, light. Hex colours are sRGB; shaders get linear. */
export interface Archetype {
  id: string;
  label: string;
  ramp: [string, string, string, string, string]; // low → high ground
  liquid?: { deep: string; shallow: string; level: number };
  strata: number;
  strataF: number;
  terrain: { cfreq: number; amp: number; ridge: number; warp: number; terrace: number; dry: boolean };
  ice?: { color: string; amount: number };
  cloud: { tint: string; amt: number };
  atmo: { br: [number, number, number]; scatter: number };
  sun: string;
  glow?: { color: string; mode: 0 | 1; amt: number; day: number };
  sky: [string, string, string];
  accent: string;
}

export const ARCHETYPES: Archetype[] = [
  {
    id: 'ember', label: 'Magma', accent: '#ff7a3d',
    ramp: ['#120708', '#2a0f0f', '#4a1a14', '#7a2e1c', '#c25a2a'],
    strata: 0.15, strataF: 6,
    terrain: { cfreq: 1.5, amp: 0.3, ridge: 0.5, warp: 0.4, terrace: 0, dry: true },
    cloud: { tint: '#4a3a36', amt: 0.45 },
    atmo: { br: [46, 16, 5], scatter: 0.55 }, sun: '#ffd9b0',
    glow: { color: '#ff5a1f', mode: 1, amt: 2.2, day: 0.4 },
    sky: ['#4a1210', '#1a0a2a', '#6a3012'],
  },
  {
    id: 'saltglass', label: 'Salt flats', accent: '#ff6fa8',
    ramp: ['#b8527e', '#d9809f', '#f0b4b8', '#f6d9c4', '#fff1de'],
    liquid: { deep: '#0b6f86', shallow: '#25d0c0', level: 0.02 },
    strata: 0.55, strataF: 5,
    terrain: { cfreq: 1.9, amp: 0.12, ridge: 0.05, warp: 0.15, terrace: 6, dry: false },
    cloud: { tint: '#ffe3ee', amt: 0.6 },
    atmo: { br: [30, 20, 42], scatter: 0.6 }, sun: '#fff3e6',
    sky: ['#4a1a4f', '#17306a', '#6a2a40'],
  },
  {
    id: 'verdigris', label: 'Moss', accent: '#4af0c4',
    ramp: ['#0b2a2f', '#0f5a55', '#1ea08a', '#7fd6a6', '#e4f7b8'],
    liquid: { deep: '#2b0a5e', shallow: '#8a3fe0', level: 0.08 },
    strata: 0.2, strataF: 6,
    terrain: { cfreq: 1.1, amp: 0.3, ridge: 0.25, warp: 0.3, terrace: 0, dry: false },
    cloud: { tint: '#d6fff0', amt: 0.7 },
    atmo: { br: [8, 32, 20], scatter: 0.6 }, sun: '#eafff2',
    glow: { color: '#3ff0ff', mode: 0, amt: 1.5, day: 0 },
    sky: ['#0c3a3a', '#2a1060', '#0a4a30'],
  },
  {
    id: 'cobalt', label: 'Dunes', accent: '#6aa8ff',
    ramp: ['#0a1240', '#1230a0', '#2f66e8', '#6ab4ff', '#d8f0ff'],
    strata: 0.35, strataF: 9,
    terrain: { cfreq: 1.3, amp: 0.14, ridge: 0.0, warp: 0.9, terrace: 0, dry: true },
    cloud: { tint: '#ffffff', amt: 0.0 },
    atmo: { br: [20, 12, 50], scatter: 0.7 }, sun: '#ffcf9a',
    sky: ['#101a60', '#3a1a70', '#0a3a6a'],
  },
  {
    id: 'sulfur', label: 'Strata', accent: '#d8e84a',
    ramp: ['#3a3000', '#8a7a00', '#c9b81a', '#e8e060', '#f6f0b0'],
    liquid: { deep: '#0f6a1a', shallow: '#9cff3a', level: 0.06 },
    strata: 0.6, strataF: 7,
    terrain: { cfreq: 1.6, amp: 0.25, ridge: 0.4, warp: 0.2, terrace: 4, dry: false },
    cloud: { tint: '#f2f0a0', amt: 0.55 },
    atmo: { br: [30, 38, 6], scatter: 0.7 }, sun: '#fff7c8',
    sky: ['#2a3a0a', '#102a1a', '#4a3a08'],
  },
  {
    id: 'frostbloom', label: 'Frost', accent: '#c58aff',
    ramp: ['#2a2f6e', '#6a6fc8', '#a9adf0', '#dcdcff', '#ffffff'],
    strata: 0.25, strataF: 5,
    terrain: { cfreq: 1.2, amp: 0.2, ridge: 0.3, warp: 0.25, terrace: 0, dry: true },
    ice: { color: '#eef0ff', amount: 0.55 },
    cloud: { tint: '#f0e0ff', amt: 0.4 },
    atmo: { br: [30, 14, 48], scatter: 0.55 }, sun: '#e8f0ff',
    glow: { color: '#ff3fd0', mode: 1, amt: 1.0, day: 0.3 },
    sky: ['#1a1a6a', '#4a1060', '#103a7a'],
  },
  {
    id: 'orchid', label: 'Tidal', accent: '#ff5ac8',
    ramp: ['#3a5a10', '#8ac832', '#d6f06a', '#f4ffb0', '#ffffff'],
    liquid: { deep: '#4a0a5a', shallow: '#e04ab8', level: 0.24 },
    strata: 0.1, strataF: 6,
    terrain: { cfreq: 2.3, amp: 0.2, ridge: 0.12, warp: 0.2, terrace: 0, dry: false },
    cloud: { tint: '#ffd0f0', amt: 0.85 },
    atmo: { br: [40, 12, 34], scatter: 0.6 }, sun: '#ffe8f0',
    sky: ['#4a0a50', '#1a1a6a', '#6a1a3a'],
  },
  {
    id: 'rust', label: 'Canyon', accent: '#ffa24a',
    ramp: ['#2a0e0a', '#7a2a14', '#c8501e', '#f08a3a', '#ffd08a'],
    strata: 0.8, strataF: 11,
    terrain: { cfreq: 1.0, amp: 0.35, ridge: 0.6, warp: 0.35, terrace: 8, dry: true },
    cloud: { tint: '#ffd8b8', amt: 0.15 },
    atmo: { br: [6, 30, 44], scatter: 0.6 }, sun: '#fff0d8',
    sky: ['#3a1008', '#101a3a', '#3a2a10'],
  },
  {
    id: 'obsidian', label: 'Glass', accent: '#3affb0',
    ramp: ['#050508', '#0a0a14', '#14142a', '#1e1e3c', '#2c2c58'],
    strata: 0.3, strataF: 8,
    terrain: { cfreq: 1.4, amp: 0.28, ridge: 0.5, warp: 0.5, terrace: 0, dry: true },
    cloud: { tint: '#9aa0ff', amt: 0.25 },
    atmo: { br: [8, 40, 26], scatter: 0.5 }, sun: '#d0ffe8',
    glow: { color: '#3affb0', mode: 1, amt: 1.5, day: 0.9 },
    sky: ['#06201a', '#1a0a40', '#0a2a3a'],
  },
];

/** Anything with a colour identity: planet archetypes, stars and black holes share this. */
export interface Template {
  id: string;
  label: string;
  ramp: [string, string, string, string, string];
  sky: [string, string, string];
  accent: string;
}

export const STARS: Template[] = [
  { id: 'dwarf', label: 'Dwarf star', accent: '#ff7a3d', ramp: ['#1a0300', '#5a0e00', '#b52a05', '#ff6a1a', '#ffc080'], sky: ['#3a0a00', '#14041a', '#4a1a08'] },
  { id: 'main', label: 'Main-sequence star', accent: '#ffc24a', ramp: ['#3a1500', '#a84a00', '#ff9a10', '#ffd860', '#fff6d0'], sky: ['#3a1a00', '#101a40', '#4a2a08'] },
  { id: 'giant', label: 'Giant star', accent: '#6aa8ff', ramp: ['#0a1a50', '#2050c0', '#5aa0ff', '#b8e0ff', '#ffffff'], sky: ['#0a1a60', '#3a1a70', '#0a3a6a'] },
  { id: 'magnetar', label: 'Magnetar', accent: '#d070ff', ramp: ['#1a0040', '#5010a0', '#c040ff', '#ff90ff', '#ffe8ff'], sky: ['#2a0a60', '#0a1a50', '#5a1060'] },
  { id: 'pulsar', label: 'Pulsar', accent: '#40e890', ramp: ['#001a10', '#006030', '#20d070', '#a0ffb0', '#f0fff0'], sky: ['#06301a', '#0a1a40', '#0a4a3a'] },
];

export const HOLES: Template[] = [
  { id: 'quasar', label: 'Black hole', accent: '#ff8a3a', ramp: ['#1a0400', '#8a2000', '#ff6a10', '#ffc860', '#ffffff'], sky: ['#2a1040', '#101a40', '#40200a'] },
  { id: 'cold', label: 'Black hole', accent: '#6ad0ff', ramp: ['#00081a', '#0a3a8a', '#20a0ff', '#a0e8ff', '#ffffff'], sky: ['#0a1a50', '#2a1060', '#0a3a5a'] },
  { id: 'singularity', label: 'Singularity', accent: '#e060ff', ramp: ['#10001a', '#601080', '#e040ff', '#ffa0f0', '#ffffff'], sky: ['#3a0a50', '#10104a', '#501040'] },
];

export type Kind = 'planet' | 'star' | 'hole';

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
  tpl: Template;
  arch: Archetype | null; // planet-only parameters
  terrainSeed: THREE.Vector3;
  hue: number; // palette rotation, full circle
  sat: number;
  ring: RingSpec | null;
  tilt: [number, number]; // axis tilt toward the camera / roll
  activity: number; // star storms
  size: number; // overall scale, rolled last so older seeds keep their other traits
  accent: string;
}

const mulberry = (a: number) => () => {
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

function rollRing(r: () => number): RingSpec {
  const inner = 1.22 + r() * 0.45;
  const outer = inner + 0.18 + r() * r() * 1.1 + r() * 0.25;
  const gaps: [number, number][] = [];
  for (let i = Math.floor(r() * 3.4); i > 0; i--) gaps.push([0.08 + r() * 0.84, 0.008 + r() * 0.05]);
  const h = r();
  return {
    inner, outer, gaps,
    amount: 0.5 + r() * 0.5,
    f1: 18 + r() * 60,
    f2: 80 + r() * 200,
    a: hsl(h, 0.15 + r() * 0.55, 0.6 + r() * 0.22),
    b: hsl(h + (r() - 0.5) * 0.18, 0.25 + r() * 0.45, 0.32 + r() * 0.2),
  };
}

/** `kind` forces a family ('star', 'hole', 'planet') or one planet archetype id; `avoid` keeps a reroll from repeating itself. */
export function rollWorld(seed: number, kind?: string, avoid?: string): World {
  const r = mulberry(seed);
  let family: Kind;
  if (kind === 'star' || kind === 'hole' || kind === 'planet') family = kind;
  else if (kind) family = 'planet';
  else { const k = r(); family = k < 0.16 ? 'star' : k < 0.32 ? 'hole' : 'planet'; }

  const pool: Template[] = family === 'star' ? STARS : family === 'hole' ? HOLES : ARCHETYPES;
  let candidates = pool;
  const forced = kind ? pool.find((t) => t.id === kind) : undefined;
  if (!forced && avoid) candidates = pool.filter((t) => t.id !== avoid);
  const tpl = forced ?? candidates[Math.floor(r() * candidates.length)];
  const arch = family === 'planet' ? (tpl as Archetype) : null;

  const pick = <T,>(x: T[]) => x[Math.floor(r() * x.length)];
  const base = `${pick(A)}${pick(B)}${pick(C)}`;
  const name = family === 'hole' ? base : `${base} ${pick(ROMAN)}`;
  const terrainSeed = new THREE.Vector3(r() * 40, r() * 40, r() * 40);
  // one in five worlds keeps its authored palette; the rest are rotated anywhere on the colour wheel
  const hue = family === 'hole' || r() < 0.2 ? (r() - 0.5) * 0.08 : r() - 0.5;
  const sat = (r() - 0.5) * 0.3;
  const ring = family === 'planet' && r() < 0.42 ? rollRing(r) : null;
  const tilt: [number, number] = family === 'hole'
    ? [0.05 + r() * 0.13, (r() - 0.5) * 0.6]
    : [0.1 + r() * 0.5, (r() - 0.5) * 1.5];
  const activity = 0.4 + r() * 0.6;
  const size = 0.84 + r() * 0.3;

  // UI accent follows the rolled palette; keep it bright enough to read on the dark page
  const c = new THREE.Color(tpl.accent);
  const h = { h: 0, s: 0, l: 0 };
  c.getHSL(h, THREE.SRGBColorSpace);
  c.setHSL((h.h + hue + 1) % 1, Math.max(0.65, Math.min(1, h.s + sat)), Math.min(0.7, Math.max(0.58, h.l)), THREE.SRGBColorSpace);
  const accent = '#' + c.getHexString(THREE.SRGBColorSpace);

  return { seed, name, kind: family, tpl, arch, terrainSeed, hue, sat, ring, tilt, activity, size, accent };
}

/** Rotates a colour around the wheel by the world's hue, with a little saturation drift. */
export const tintWith = (w: Pick<World, 'hue' | 'sat'>) => (hex: string): THREE.Vector3 => {
  const c = new THREE.Color(hex);
  const h = { h: 0, s: 0, l: 0 };
  c.getHSL(h);
  const chromatic = h.s > 0.08;
  c.setHSL(chromatic ? (h.h + w.hue + 1) % 1 : h.h, chromatic ? Math.max(0, Math.min(1, h.s * (1 + w.sat))) : h.s, h.l);
  return new THREE.Vector3(c.r, c.g, c.b);
};

export const randomSeed = () => Math.floor(Math.random() * 0xffffff);
