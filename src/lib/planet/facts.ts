import { COMET_PALETTES, GALAXY_SHAPE, mulberry, NEBULA_SHAPES, type World } from './archetypes';

export interface Fact { k: string; v: string }

const EARTH_KM = 6371;
const JUPITER_M = 317.8; // in Earth masses

interface Rock { density: [number, number]; atmo: string; bar: [number, number]; ores: string[] }

/** What each ground template is made of. Densities are in g/cm³ (Earth 5.51), pressure in bar. */
const ROCK: Record<string, Rock> = {
  ember: { density: [4.6, 5.6], atmo: 'SO₂ · CO₂', bar: [8, 60], ores: ['Nickel-iron', 'Olivine', 'Sulfides'] },
  saltglass: { density: [3.2, 4.4], atmo: 'N₂ · CO₂', bar: [0.3, 1.5], ores: ['Halite', 'Lithium brine', 'Borates'] },
  verdigris: { density: [4.2, 5.4], atmo: 'N₂ · O₂ · Ar', bar: [0.6, 2], ores: ['Copper', 'Malachite', 'Zinc'] },
  cobalt: { density: [3.6, 5], atmo: 'CO₂ · N₂ · Ar', bar: [0.2, 1.2], ores: ['Cobalt', 'Silica sand', 'Nickel'] },
  sulfur: { density: [3.4, 4.6], atmo: 'SO₂ · N₂', bar: [0.8, 4], ores: ['Native sulfur', 'Pyrite', 'Gypsum'] },
  frostbloom: { density: [2.4, 3.6], atmo: 'N₂ · CH₄', bar: [0.4, 2.5], ores: ['Water ice', 'Methane clathrate', 'Ammonia ice'] },
  orchid: { density: [3, 4.2], atmo: 'N₂ · O₂ · H₂O', bar: [0.8, 3], ores: ['Lithium', 'Rare earths', 'Phosphates'] },
  rust: { density: [3.8, 5], atmo: 'CO₂ · N₂ · Ar', bar: [0.05, 0.8], ores: ['Hematite', 'Iron', 'Manganese'] },
  obsidian: { density: [3.4, 4.8], atmo: 'CO₂ · SO₂', bar: [0.5, 5], ores: ['Silica glass', 'Titanium', 'Tungsten'] },
  cinder: { density: [4.8, 5.7], atmo: '', bar: [0, 0], ores: ['Graphite', 'Iron', 'Platinum group'] },
  abyss: { density: [2.2, 3.6], atmo: 'N₂ · O₂ · H₂O', bar: [0.8, 4], ores: ['Deuterium', 'Sea salts', 'Manganese nodules'] },
  glacier: { density: [1.6, 3], atmo: 'N₂ · CH₄', bar: [0.001, 0.3], ores: ['Water ice', 'Nitrogen ice', 'Ammonia ice'] },
  regolith: { density: [3.2, 5.4], atmo: '', bar: [0, 0], ores: ['Helium-3', 'Ilmenite', 'Anorthosite'] },
  veil: { density: [4.6, 5.5], atmo: 'CO₂ · N₂ · H₂SO₄', bar: [40, 110], ores: ['Sulfuric acid', 'Basalt', 'Carbon dioxide'] },
};

/** How well each ground template could host life before pressure, gravity and water are weighed in. */
const HABITABLE: Record<string, number> = {
  verdigris: 0.85, orchid: 0.8, saltglass: 0.45, frostbloom: 0.3, cobalt: 0.25, rust: 0.2, sulfur: 0.12, obsidian: 0.03, ember: 0.02, cinder: 0, abyss: 0.9, glacier: 0.15, regolith: 0, veil: 0.01,
};

const bell = (x: number, mid: number, width: number) => Math.exp(-(((x - mid) / width) ** 2));

interface Gas { radius: [number, number]; density: [number, number]; ores: string[] }

const GAS: Record<string, Gas> = {
  jovian: { radius: [8, 12], density: [0.9, 1.5], ores: ['Helium-3', 'Hydrogen'] },
  ammonia: { radius: [3, 5], density: [1.2, 1.9], ores: ['Ammonia', 'Methane'] },
  tempest: { radius: [6, 10], density: [0.8, 1.4], ores: ['Helium-3', 'Hydrogen'] },
};

const group = (n: number, digits = 0) => n.toLocaleString('en-US', { maximumFractionDigits: digits });
const sig = (n: number) => (n >= 100 ? group(n) : n >= 10 ? n.toFixed(1) : n.toFixed(2));
const sup = (n: number) => String(n).replace(/-/g, '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]);
const power = (n: number) => {
  const e = Math.floor(Math.log10(n));
  return `${(n / 10 ** e).toFixed(1)} × 10${sup(e)}`;
};
const lerp = (r: number, [a, b]: [number, number]) => a + (b - a) * r;
/** A chance, and what a survey of that world turns up: the chance is the stat, the finding is one roll against it. */
const life = (chance: number, r: () => number) => {
  const pct = chance < 0.005 ? '<1%' : `${Math.round(chance * 100)}%`;
  const found = r() < chance;
  const kind = r();
  return `${pct} chance, ${found ? (kind < 0.62 ? 'microbial' : kind < 0.93 ? 'complex ecosystems' : 'signs of intelligence') : 'none detected'}`;
};
const hours = (h: number) => (h > 48 ? `${(h / 24).toFixed(1)} days` : `${h.toFixed(1)} h`);

const spectral = (k: number) => (k >= 30000 ? 'O' : k >= 10000 ? 'B' : k >= 7500 ? 'A' : k >= 6000 ? 'F' : k >= 5200 ? 'G' : k >= 3700 ? 'K' : 'M');

const period = (s: number) => (s < 0.01 ? `${(s * 1000).toFixed(2)} ms` : s < 1 ? `${(s * 1000).toFixed(0)} ms` : `${s.toFixed(2)} s`);

/**
 * The numbers behind a world, rolled from its seed on a separate stream so nothing that is drawn depends on them.
 * Real physics where it is cheap (mass from radius and density, surface gravity, Schwarzschild radius); the rest is
 * plausible and consistent, not a simulation.
 */
export function describe(w: World): Fact[] {
  const r = mulberry((w.seed ^ 0x9e3779b1) >>> 0);
  const facts: Fact[] = [];
  const add = (k: string, v: string) => facts.push({ k, v });
  const id = w.tpl.id;

  if (w.kind === 'planet') {
    const gas = GAS[id];
    const rock = ROCK[id];
    const radius = gas ? lerp(r(), gas.radius) * w.size : (0.4 + r() * 1.4) * w.size; // Earth radii
    const density = lerp(r(), (gas ?? rock).density);
    const mass = (density / 5.51) * radius ** 3; // Earth masses
    const g = (9.81 * mass) / radius ** 2;
    add('Radius', `${group(radius * EARTH_KM)} km`);
    add('Mass', mass >= 60 ? `${(mass / JUPITER_M).toFixed(2)} Jupiters` : `${mass.toFixed(2)} Earths`);
    add('Gravity', `${g.toFixed(1)} m/s²${gas ? ' at the cloud tops' : ''}`);
    if (gas) {
      const he = lerp(r(), [8, 13]);
      const trace = lerp(r(), [0.2, 2.5]);
      const third = id === 'ammonia' ? 'NH₃' : id === 'tempest' ? 'H₂O' : 'CH₄';
      add('Atmosphere', `H₂ ${(100 - he - trace).toFixed(0)}% · He ${he.toFixed(0)}% · ${third} ${trace.toFixed(1)}%`);
      add('Life', life(0.004 + r() * 0.03, r)); // only drifting aerial life, if any
      add('Main resource', gas.ores[Math.floor(r() * gas.ores.length)]);
      add('Day', hours(lerp(r(), [8, 20])));
    } else {
      const bar = rock.bar[1] ? lerp(r(), rock.bar) : 0;
      add('Atmosphere', bar ? `${rock.atmo} · ${sig(bar)} bar` : 'None, a trace of argon');
      // air to breathe and keep water liquid, a gravity a body can live under, and open water to start from
      const air = bar ? bell(Math.log(bar), Math.log(1.2), 1) : 0.03;
      const pull = bell(g, 10, 9);
      const water = w.arch?.liquid ? 1 : 0.7;
      add('Life', life(Math.min(0.92, HABITABLE[id] * air * pull * water * lerp(r(), [0.85, 1.15])), r));
      add('Main resource', rock.ores[Math.floor(r() * rock.ores.length)]);
      add('Day', hours(10 ** lerp(r(), [0.8, 1.9])));
    }
  } else if (w.kind === 'star' && w.type.jets) {
    const magnetar = id === 'magnetar';
    add('Mass', `${lerp(r(), [1.2, 2.1]).toFixed(2)} Suns`);
    add('Radius', `${lerp(r(), [10, 13]).toFixed(1)} km`);
    add('Spin', `one turn in ${period(w.period)}`);
    add('Magnetic field', `${power(10 ** (magnetar ? lerp(r(), [14, 15.3]) : lerp(r(), [8, 12])))} gauss`);
    if (w.companion) add('Companion', `a second neutron star, ${(w.companion.q * 100).toFixed(0)}% of the mass`);
  } else if (w.kind === 'star') {
    const giant = id === 'giant';
    const temp = w.temp;
    // a main-sequence star's mass follows from its temperature (roughly L ∝ M³·⁵, T ∝ M⁰·⁵); a giant has left that line
    const mass = giant ? lerp(r(), temp > 8000 ? [8, 20] : [1, 8]) : (temp / 5772) ** 2;
    const radius = giant ? (temp > 8000 ? lerp(r(), [10, 40]) : lerp(r(), [10, 200])) : mass ** 0.8 * lerp(r(), [0.9, 1.1]);
    add('Mass', `${mass.toFixed(2)} Suns`);
    add('Radius', `${radius >= 100 ? group(radius) : radius.toFixed(2)} Suns`);
    add('Surface', `${group(temp)} K, class ${spectral(temp)}`);
    add('Fuel', giant ? 'Helium, then carbon' : 'Hydrogen');
    if (w.companion) add('Companion', `a second star, ${group(w.companion.temp)} K, ${(w.companion.q * 100).toFixed(0)}% of the mass`);
  } else if (w.kind === 'hole') {
    // a quasar's engine is supermassive; the other two are the remnants of single stars
    const mass = id === 'quasar' ? 10 ** lerp(r(), [6, 9.4]) : lerp(r(), [id === 'cold' ? 8 : 3, id === 'cold' ? 60 : 20]);
    const km = 2.953 * mass;
    add('Mass', `${mass >= 1e5 ? power(mass) : mass.toFixed(1)} Suns`);
    add('Event horizon', km > 1.5e8 ? `${(km / 1.496e8).toFixed(1)} AU across` : `${group(km)} km in radius`);
    add('Surroundings', id === 'quasar' ? 'a bright accretion disk and twin jets' : id === 'cold' ? 'dark, with a faint disk' : 'a thin disk of hot gas');
  } else if (w.kind === 'comet') {
    add('Nucleus', `${lerp(r(), [0.6, 18]).toFixed(1)} km across`);
    add('Mass', `${power(10 ** lerp(r(), [12, 15.5]))} kg`);
    add('Composition', 'H₂O ice · CO₂ · dust');
    add('Coma', COMET_PALETTES[w.comet.palette].name);
    const c = w.comet;
    const marks = [c.fragments ? `nucleus broken in ${c.fragments + 1}` : '', c.striae ? 'striated dust tail' : '', c.sodium ? 'sodium tail' : '', c.anti ? 'anti-tail' : '', c.shells ? 'shells round the head' : ''].filter(Boolean);
    if (marks.length) add('Features', marks.join(', '));
    add('Life', life(0.008, r)); // prebiotic chemistry at best
    add('Main resource', 'Water ice');
  } else if (w.nebula === GALAXY_SHAPE) {
    add('Type', 'Spiral galaxy');
    add('Stars', power(10 ** lerp(r(), [9.5, 11.8])));
    add('Diameter', `${group(lerp(r(), [30, 180]) * 1000)} light-years`);
    add('Distance', `${lerp(r(), [2, 90]).toFixed(1)} million light-years`);
  } else {
    add('Shape', NEBULA_SHAPES[w.nebula]);
    add('Width', `${lerp(r(), [1, 120]).toFixed(1)} light-years`);
    add('Gas', 'Hydrogen · helium · dust');
  }
  add('Seed', w.seed.toString(16).toUpperCase().padStart(6, '0'));
  return facts;
}

