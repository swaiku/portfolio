// Real spacecraft for the sheet's tiles, as line drawings made from NASA's own 3D models
// (github.com/nasa/NASA-3D-Resources, free of copyright) by tools/wireframe.ts. The files live in public/crafts.
// `made` is how each was drawn, to draw it again: bun tools/wireframe.ts <model> public/crafts/<file> <made>

export interface Craft { name: string; note: string; file: string; made: string }

// each launcher fills the height it is given: they are not at one scale
const L = '--fit 330 --floor 334';
export const launchers: Craft[] = [
  { name: 'Saturn V', note: '110.6 m', file: 'saturn-v.svg', made: `--box 56,336 ${L}` },
  { name: 'SLS Block 1', note: '98 m', file: 'sls.svg', made: `--box 84,336 ${L} --up z --clip 0.03,1` },
  { name: 'Space Shuttle', note: '56 m', file: 'shuttle.svg', made: `--box 108,336 ${L} --up -z --yaw 60` },
  { name: 'Jupiter-C', note: '21 m', file: 'jupiter-c.svg', made: `--box 52,336 ${L} --crease 70` },
];

const T = '--box 160,150 --fit 140';
export const probes: Craft[] = [
  { name: 'James Webb', note: '2021', file: 'webb.svg', made: `${T} --yaw 30 --pitch 20` },
  { name: 'Hubble', note: '1990', file: 'hubble.svg', made: `${T} --yaw 30 --pitch 20` },
  { name: 'Voyager', note: '1977', file: 'voyager.svg', made: `${T} --yaw 30 --pitch 20` },
  { name: 'Cassini', note: '1997', file: 'cassini.svg', made: `${T} --yaw 300 --pitch 20` },
  { name: 'Ingenuity', note: '2020', file: 'ingenuity.svg', made: `${T} --yaw 120 --pitch 20` },
  // the model is far denser than a tile can show: only the sharpest folds and the longer strokes are kept
  { name: 'Perseverance', note: '2020', file: 'perseverance.svg', made: `${T} --yaw 30 --pitch 20 --crease 85 --min 6` },
  { name: 'Opportunity', note: '2003', file: 'opportunity.svg', made: `${T} --yaw 330 --pitch 20` },
];
