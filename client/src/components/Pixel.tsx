/**
 * Tiny pixel-art sprites drawn from ASCII grids. Each character is one pixel;
 * '.' is transparent and every other character is looked up in `palette`.
 */
export function PixelArt({ rows, palette }: { rows: string[]; palette: Record<string, string> }) {
  return (
    <>
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) =>
          ch === '.' ? null : <rect key={`${x},${y}`} x={x} y={y} width={1.02} height={1.02} fill={palette[ch]} />,
        ),
      )}
    </>
  );
}

export function Sprite({ rows, palette, className }: { rows: string[]; palette: Record<string, string>; className?: string }) {
  return (
    <svg className={`sprite ${className ?? ''}`} viewBox={`0 0 ${rows[0].length} ${rows.length}`} shapeRendering="crispEdges" aria-hidden>
      <PixelArt rows={rows} palette={palette} />
    </svg>
  );
}

const CHEF_HAT = [
  '..aa.aa..',
  '.awwawwa.',
  'awwwwwwwa',
  'awwwwwwwa',
  '.awwwwwa.',
  '.awwwwwa.',
  '.awwwwwa.',
  '.arrrrra.',
  '.attttta.',
  '.aaaaaaa.',
];

export function ChefHat() {
  return <Sprite className="chef-hat" rows={CHEF_HAT} palette={{ a: '#1e1512', w: '#fff8ec', r: '#d0442f', t: '#d8c6a5' }} />;
}

const SPEAKER_ON = [
  '...a.....',
  '..aa..b..',
  'aaaa...b.',
  'aaaa.b.b.',
  'aaaa.b.b.',
  'aaaa...b.',
  '..aa..b..',
  '...a.....',
];
const SPEAKER_OFF = [
  '...a.....',
  '..aa.....',
  'aaaa.b.b.',
  'aaaa..b..',
  'aaaa.b.b.',
  'aaaa.....',
  '..aa.....',
  '...a.....',
];

export function Speaker({ on }: { on: boolean }) {
  return <Sprite className="speaker" rows={on ? SPEAKER_ON : SPEAKER_OFF} palette={{ a: '#2a1e19', b: '#2a1e19' }} />;
}

const CLOCHE = [
  '....aa....',
  '...abba...',
  '..abbbcca.',
  '.abbbbbcca',
  '.abbbbbbca',
  '.abbbbbbca',
  'aaaaaaaaaa',
  'dddddddddd',
];

export function Cloche() {
  return <Sprite className="ing-icon" rows={CLOCHE} palette={{ a: '#6f6c68', b: '#a8a5a0', c: '#cfccc6', d: '#4d4a47' }} />;
}

// Ingredient sprites: a few generic shapes, picked by keyword and tinted by a
// hash of the name so every ingredient on the ticket gets its own little icon.
const SHAPES = {
  nut: [
    '..aaaa..',
    '.abbbba.',
    'abcbbbba',
    'abbbbbba',
    'abbbbbba',
    'abbbbbba',
    '.abbbba.',
    '..aaaa..',
  ],
  sprig: [
    '....a...',
    '.bb.a.bb',
    '..bba...',
    '....abb.',
    '.bb.a...',
    '..bba.b.',
    '....abb.',
    '....a...',
  ],
  seeds: [
    '......a.',
    '..b.....',
    'aa...bb.',
    '.....a..',
    '.bb.....',
    '...aa.b.',
    'b.......',
    '..a..bb.',
  ],
  drop: [
    '...a....',
    '...aa...',
    '..abba..',
    '..abba..',
    '.abcbba.',
    '.abbbba.',
    '.abbbba.',
    '..aaaa..',
  ],
  chunk: [
    '........',
    '.aaaaaa.',
    'abcbbbba',
    'abbbbbba',
    'abbbbbba',
    'abbbbbba',
    '.aaaaaa.',
    '........',
  ],
} satisfies Record<string, string[]>;

const KEYWORDS: [RegExp, keyof typeof SHAPES][] = [
  [/seed|pepper|cumin|rice|sesame|salt|sugar|flour|spice|powder|paprika|cinnamon|grain|oats|semolina|yeast/, 'seeds'],
  [/basil|parsley|cilantro|coriander|mint|thyme|oregano|rosemary|dill|herb|leaf|leaves|marjoram|sage|lettuce|spinach|scallion|onion|chive|cabbage|kale|lemongrass|bay/, 'sprig'],
  [/oil|sauce|milk|cream|stock|broth|wine|vinegar|water|juice|syrup|honey|soy|yogurt|gravy|mustard/, 'drop'],
  [/beef|pork|chicken|lamb|bacon|ham|cheese|tofu|butter|bread|meat|fish|sausage|steak|paneer|feta|mozzarella|gruy/, 'chunk'],
];

const TINTS = [
  { a: '#4a2a1a', b: '#8a4a2c', c: '#c07a4a' },
  { a: '#2b4a1c', b: '#5a9a3a', c: '#94cc6a' },
  { a: '#5a1e16', b: '#b53c2a', c: '#e8735a' },
  { a: '#5a4210', b: '#d8a530', c: '#f4d77a' },
  { a: '#4a3020', b: '#c49a6c', c: '#ecd2a8' },
  { a: '#3a2246', b: '#7a4a8a', c: '#b48ac4' },
  { a: '#5a2a0a', b: '#d9772a', c: '#f4a860' },
];

export function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function IngredientIcon({ name }: { name: string }) {
  const h = hash(name);
  const shape = KEYWORDS.find(([re]) => re.test(name))?.[1] ?? (['nut', 'chunk', 'drop'] as const)[h % 3];
  // Herbs read best green no matter what the hash says.
  const tint = shape === 'sprig' ? TINTS[1] : TINTS[h % TINTS.length];
  return <Sprite className="ing-icon" rows={SHAPES[shape]} palette={tint} />;
}

