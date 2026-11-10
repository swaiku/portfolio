// Real spacecraft for the sheet's tiles, as line drawings made from NASA's own 3D models
// (github.com/nasa/NASA-3D-Resources, free of copyright) by tools/wireframe.ts. The files live in public/crafts.

export interface Craft { name: string; note: string; file: string }

// both launchers are drawn at one scale (2.7 units per metre), standing on the same floor
export const launchers: Craft[] = [
  { name: 'Saturn V', note: '110.6 m', file: 'saturn-v.svg' },
  { name: 'SLS Block 1', note: '98 m', file: 'sls.svg' },
];

export const telescopes: Craft[] = [
  { name: 'James Webb', note: '6.5 m mirror', file: 'webb.svg' },
  { name: 'Hubble', note: '2.4 m mirror', file: 'hubble.svg' },
];

// how each drawing was made, to make it again:
//   saturn-v  --box 60,336 --fit 299 --floor 332
//   sls       --box 60,336 --fit 265 --floor 332 --up z --clip 0.03,1
//   hubble    --box 160,150 --fit 140 --yaw 30 --pitch 15 --roll -50
//   webb      --box 160,150 --fit 135 --yaw 12 --pitch 25
