// Line drawings of real spacecraft for the sheet's tiles. Schematic, not survey-grade: proportions follow the
// published dimensions, the detail is only what makes each one recognisable.

export interface Craft {
  name: string;
  note: string;
  svg: string; // inner markup; `.d` marks the lighter detail lines
  tags?: [number, number, number, number][]; // callouts: the point on the craft, then where its numbered tag sits
}

// --- launchers, all at 2.7 px per metre in a 60 × 336 box, standing on y = 332 ---
export const LAUNCHER_BOX = '0 0 60 336';
export const launchers: Craft[] = [
  {
    name: 'Saturn V',
    note: '110.6 m',
    svg: `
      <path d="M16 322V152L21 138V101L25 78V67L28.5 58H31.5L35 67V78L39 101V138L44 152V322Z"/>
      <path d="M30 58V34M28.8 52V38L30 34L31.2 38V52ZM28.5 58L29 52M31.5 58L31 52"/>
      <path d="M16 300L10 322H16M44 300L50 322H44M19 322l-2 10h8l-2-10M28 322l-2 10h8l-2-10M37 322l-2 10h8l-2-10"/>
      <path class="d" d="M16 219H44M16 152H44M21 138H39M21 104H39M21 101H39M25 78H35M25 67H35M16 300H44M16 262H44M16 250H44M16 208H44M16 166H44M20 250v12M24 250v12M28 250v12M32 250v12M36 250v12M40 250v12"/>`,
  },
  {
    name: 'SLS Block 1',
    note: '98 m',
    svg: `
      <path d="M18.5 322V158L23 135V109Q24 96 28.8 90V72L30 67L31.2 72V90Q36 96 37 109V135L41.5 158V322Z"/>
      <path d="M7.5 318V198Q8 190 12.5 184Q17 190 17.5 198V318L18.5 330H6.5ZM52.5 318V198Q52 190 47.5 184Q43 190 42.5 198V318L41.5 330H53.5Z"/>
      <path d="M22.5 322l-1.5 10h6l-1.5-10M28.5 322l-1.5 10h6l-1.5-10M34.5 322l-1.5 10h6l-1.5-10"/>
      <path class="d" d="M18.5 158H41.5M23 135H37M23 122H37M23 109H37M18.5 203H41.5M18.5 215H41.5M18.5 306H41.5M7.5 300h10M7.5 262h10M7.5 226h10M7.5 198h10M42.5 300h10M42.5 262h10M42.5 226h10M42.5 198h10"/>`,
  },
  {
    name: 'Starship',
    note: '121 m',
    svg: `
      <path d="M18 135V60Q18 25 30 5Q42 25 42 60V135M18 140V332H42V140M18 135H42V140H18Z"/>
      <path d="M18 100L11 108V135H18M42 100L49 108V135H42M18.1 56L13 52L14.5 41L19.2 39.5M41.9 56L47 52L45.5 41L40.8 39.5"/>
      <path d="M18 146H12.5V156H18M42 146H47.5V156H42M18 276L16 280V318H18M42 276L44 280V318H42M22 332l-1 3h4l-1-3M28 332l-1 3h4l-1-3M34 332l-1 3h4l-1-3"/>
      <path class="d" d="M18 112H42M18 78H42M18 200H42M18 262H42M18 322H42M12.5 151H18M42 151h5.5M21 135v5M24 135v5M27 135v5M30 135v5M33 135v5M36 135v5M39 135v5"/>`,
  },
];

// --- telescopes, each in a 200 × 130 box ---
export const TELESCOPE_BOX = '0 0 200 130';

const hex = (cx: number, cy: number, r: number) =>
  'M' + [0, 1, 2, 3, 4, 5].map((i) => `${(cx + r * Math.cos((i * Math.PI) / 3)).toFixed(1)} ${(cy + r * Math.sin((i * Math.PI) / 3)).toFixed(1)}`).join('L') + 'Z';
// Webb's primary mirror: 18 segments in five columns (3, 4, 4, 4, 3), the centre one left open
const webbMirror = [-2, -1, 0, 1, 2]
  .flatMap((c) => Array.from({ length: 5 - Math.abs(c) }, (_, i) => [c, i - (4 - Math.abs(c)) / 2]))
  .filter(([c, j]) => c || j)
  .map(([c, j]) => hex(100 + c * 10.5, 48 + j * 12.12, 7))
  .join('');
// five sunshield layers: the top one whole, only the near edge of those under it
const webbShield = [1, 2, 3, 4].map((i) => `M9 ${96 + i * 2.2}L72 ${108 + i * 2.2}H128L191 ${96 + i * 2.2}`).join('');

export const telescopes: Craft[] = [
  {
    name: 'James Webb',
    note: '6.5 m mirror',
    svg: `
      <path d="${webbMirror}"/>
      <path d="M9 96L72 84H128L191 96L128 108H72Z"/>
      <circle cx="100" cy="48" r="3"/>
      <path class="d" d="M100 17.7V45M79 72L98 50M121 72L102 50M90 78V86M110 78V86M9 96H191M100 84V108${webbShield}"/>`,
    tags: [[121, 30, 152, 14], [100, 48, 48, 14], [162, 99, 186, 72], [100, 86, 18, 72]],
  },
  {
    name: 'Hubble',
    note: '2.4 m mirror',
    svg: `
      <path d="M112 47H24V83H112M24 47L10 21L7 23L21 49"/>
      <path d="M112 40H172Q182 40 182 52V78Q182 90 172 90H112Z"/>
      <path d="M76 6H120V36H76ZM76 94H120V124H76ZM98 47V36M98 83V94"/>
      <path d="M140 40L152 26M140 90L152 104"/><circle cx="155" cy="23" r="5"/><circle cx="155" cy="107" r="5"/>
      <ellipse class="d" cx="24" cy="65" rx="4" ry="18"/>
      <path class="d" d="M52 47V83M84 47V83M126 40V90M132 48H148V82H132ZM152 48H168V82H152ZM76 13.5H120M76 21H120M76 28.5H120M98 6V36M76 101.5H120M76 109H120M76 116.5H120M98 94V124M60 47v-2h14v2"/>`,
    tags: [[38, 80, 14, 108], [80, 22, 56, 12], [172, 65, 192, 65], [160, 108, 186, 120]],
  },
];
