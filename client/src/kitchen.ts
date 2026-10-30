// A top-down restaurant drawn on a canvas behind the app. Animal chefs loop
// crate → chopping board → stove → pass in the kitchen on the left; waiters
// push through the swing door, carry plates from the pass to guests in the
// dining room on the right, clear tables and drop dirty dishes at the sink.
// The floor plan, floors and colour scheme are rolled fresh on every build.

type Station =
  | 'counter' | 'stove' | 'board' | 'crate' | 'fridge' | 'sink' | 'plates' | 'pass'
  | 'wall' | 'table' | 'seat' | 'plant' | 'podium';
type Food = 'tomato' | 'lettuce' | 'onion' | 'mushroom' | 'cheese' | 'fish';
type Held = { form: 'raw' | 'chopped' | 'soup' | 'dish' | 'dirty'; food: Food } | null;
type Dir = 'up' | 'down' | 'left' | 'right';
type Role = 'chef' | 'waiter' | 'guest';
// Where someone may walk: chefs stay behind the line, guests stay out front,
// waiters ("staff") go anywhere via the swing door.
type Zone = 'kitchen' | 'dining' | 'staff';
type Hat = 'toque' | 'none' | 'bow' | 'cap' | 'beret';
type Species = keyof typeof SPECIES;

interface Tile { col: number; row: number }

interface Cell extends Tile {
  station: Station;
  food?: Food; // crate contents, or the soup simmering on a stove
  user?: Actor; // whoever has claimed this spot
  group?: number; // table id, so a long table draws as one piece
  face?: Dir; // seats: the way the sitter looks (towards the table)
  booth?: boolean;
  guest?: Actor; // seats: who's sitting here, or on their way
  plate?: { food: Food; eaten: number } | 'dirty';
  dishes?: Food[]; // pass: plates waiting for a waiter
  dirty?: number; // sink: plates waiting to be washed
}

interface Actor {
  role: Role;
  species: Species;
  shirt: string;
  hat: Hat;
  hatColor: string;
  seed: number;
  x: number; // feet position, px
  y: number;
  path: Tile[];
  dir: Dir;
  phase: number;
  dashing: boolean;
  task: Cell | null;
  working: number;
  held: Held;
  washNext: boolean;
  pause: number;
  emote: { text: string; t: number } | null;
  // Guests only
  mood?: 'arriving' | 'waiting' | 'eating' | 'leaving';
  seat?: Cell;
  order?: Food;
  timer: number;
  meal: number;
  load: number; // waiters: dirty plates stacked up
  gone?: boolean;
}

interface Particle {
  kind: 'steam' | 'dust' | 'bit' | 'bubble' | 'star' | 'text';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color?: string;
  text?: string;
}

interface Floor { pattern: 'checker' | 'tile' | 'planks' | 'parquet' | 'carpet'; colors: string[] }

interface Style {
  kitchenFloor: Floor;
  diningFloor: Floor;
  counter: { top: string; lip: string; seam: string };
  wall: string;
  table: string;
  cloth: string | null; // 'check' = gingham
  chair: string;
  booth: string;
  uniform: string;
}

interface Piece { dx: number; dy: number; station: 'table' | 'seat'; face?: Dir }

const FOODS: Food[] = ['tomato', 'lettuce', 'onion', 'mushroom', 'cheese', 'fish'];
const FOOD_COLOR: Record<Food, string> = {
  tomato: '#e5533d', lettuce: '#7cc04b', onion: '#b678c4',
  mushroom: '#b5754d', cheese: '#f7c948', fish: '#7fb3d5',
};
const SHIRTS = ['#ff8a65', '#4fc3f7', '#ba68c8', '#ffd54f', '#81c784', '#f06292', '#4db6ac', '#7986cb'];
const HAT_COLORS = ['#e5533d', '#4f6d8f', '#f7c948', '#2d6a4f', '#ff8fb1', '#3a3440'];
const INK = '#4a2f22';
const WORK_TIME: Record<Station, number> = {
  crate: 0.7, fridge: 0.9, board: 2.2, stove: 2.6, pass: 0.6, sink: 1.8, counter: 0.5, plates: 0.5,
  wall: 0, table: 0, seat: 0.6, plant: 0, podium: 0,
};
const EMOTES = ['♪', '♥', '!', '…', '?'];
// Actors stand in the lower part of their tile so bodies overlap the counter above.
const FEET = 0.72;
const CHEF_SCALE = 1.15;
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const FACING: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// ── Per-build looks ─────────────────────────────────────
const KITCHEN_FLOORS: Floor[] = [
  { pattern: 'checker', colors: ['#f3ede2', '#cfd8dc'] },
  { pattern: 'checker', colors: ['#f4efe6', '#e07a68'] },
  { pattern: 'checker', colors: ['#efe9df', '#56606e'] },
  { pattern: 'tile', colors: ['#d7e3e8', '#b1c3cb'] },
  { pattern: 'tile', colors: ['#e9dcc4', '#c6ad86'] },
  { pattern: 'tile', colors: ['#d9825b', '#b4633f'] },
];
const DINING_FLOORS: Floor[] = [
  { pattern: 'planks', colors: ['#d99c60', '#d19358', '#dea66b', '#cf8f52'] },
  { pattern: 'planks', colors: ['#a86b3c', '#9e6234', '#b0743f', '#985c30'] },
  { pattern: 'parquet', colors: ['#d7a46a', '#c48f55'] },
  { pattern: 'parquet', colors: ['#b98552', '#a2703f'] },
  { pattern: 'carpet', colors: ['#8e3b46', '#a3505a', '#e6c27a'] },
  { pattern: 'carpet', colors: ['#2f6f73', '#3f8589', '#e9d8a6'] },
];
const COUNTERS = [
  { top: '#86d39a', lip: '#4e9e66', seam: '#b6e9c1' },
  { top: '#8ec5e8', lip: '#4f8fbf', seam: '#c3e2f5' },
  { top: '#f2a093', lip: '#c4645a', seam: '#f9cbc3' },
  { top: '#f1e3c3', lip: '#c2a873', seam: '#fbf4e3' },
  { top: '#d3dbe1', lip: '#8d99a3', seam: '#eef2f5' },
];
const DINING_WALLS = ['#6f9a7a', '#c56b5c', '#4f6d8f', '#d3a24f', '#8a6aa3'];
const TABLE_WOODS = ['#a8703f', '#8a5a33', '#c48a52', '#6e4a2f'];
const CLOTHS = [null, null, '#fffaf0', '#f4d6d0', 'check'];
const CHAIRS = ['#c0392b', '#2d6a4f', '#355c7d', '#e1a140', '#6d4c41'];
const BOOTHS = ['#b23a48', '#2f6f73', '#d08c3a', '#5b4a8a'];
const UNIFORMS = ['#2d2d3a', '#3b2f4a', '#1f3b4d', '#5a2a2a'];

// Island themes, so a block of counters reads as a prep station or a hot line.
const THEMES: [Station, number][][] = [
  [['counter', 30], ['board', 30], ['plates', 8], ['crate', 10]],
  [['stove', 45], ['counter', 25]],
  [['counter', 30], ['stove', 15], ['board', 14], ['crate', 14], ['plates', 6], ['sink', 4]],
];
const LEFT_WALL: [Station, number][] = [['crate', 35], ['fridge', 25], ['counter', 25], ['plates', 10]];

const seat = (dx: number, dy: number, face: Dir): Piece => ({ dx, dy, station: 'seat', face });
const table = (dx: number, dy: number): Piece => ({ dx, dy, station: 'table' });
const banquet = (n: number) =>
  Array.from({ length: n }, (_, i) => [seat(i, 0, 'down'), table(i, 1), seat(i, 2, 'up')]).flat();
const TABLE_SETS: Piece[][] = [
  [seat(0, 0, 'right'), table(1, 0), seat(2, 0, 'left')],
  [seat(0, 0, 'down'), table(0, 1), seat(0, 2, 'up')],
  [seat(1, 0, 'down'), seat(0, 1, 'right'), table(1, 1), seat(2, 1, 'left'), seat(1, 2, 'up')],
  banquet(2),
  banquet(3),
];
const BOOTH = TABLE_SETS[1];

const SPECIES = {
  cat: { fur: '#f4a259', inner: '#ffc4c4' },
  bear: { fur: '#a9744f', inner: '#7d5235' },
  bunny: { fur: '#f7f1e8', inner: '#ffb7c5' },
  frog: { fur: '#8bd17c', inner: '#ffffff' },
  duck: { fur: '#ffe27a', inner: '#f39c34' },
  pig: { fur: '#ffb8c6', inner: '#f48fa3' },
  dog: { fur: '#e3c39b', inner: '#9b6b43' },
  penguin: { fur: '#3d4658', inner: '#ffffff' },
  koala: { fur: '#a7adb8', inner: '#f1e4e8' },
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
const beside = (t: Tile) => (col: number, row: number) => Math.abs(col - t.col) + Math.abs(row - t.row) === 1;

function weighted<T>(entries: [T, number][]): T {
  let r = Math.random() * entries.reduce((n, [, w]) => n + w, 0);
  for (const [v, w] of entries) if ((r -= w) < 0) return v;
  return entries[0][0];
}

function footprint(set: Piece[]) {
  return { w: Math.max(...set.map((p) => p.dx)) + 1, h: Math.max(...set.map((p) => p.dy)) + 1 };
}

export class Kitchen {
  private ctx: CanvasRenderingContext2D;
  private floor: HTMLCanvasElement;
  private T: number;
  private s: number;
  private cols: number;
  private rows: number;
  private wallCol: number;
  private grid: (Cell | null)[][];
  private cells: Cell[] = [];
  private seats: Cell[] = [];
  private passes: Cell[] = [];
  private door!: Tile & { open: number; swing: number };
  private entrance!: Tile;
  private style: Style;
  private actors: Actor[] = [];
  private particles: Particle[] = [];
  private time = 0;
  private nextGuest = 0;
  private nextGroup = 1;

  constructor(canvas: HTMLCanvasElement, private w: number, private h: number, private dpr: number) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    this.ctx = canvas.getContext('2d')!;
    // Stretch tiles slightly so whole columns span the width exactly and the
    // front door and booths on the right edge aren't cut off.
    this.cols = Math.max(1, Math.round(w / (w < 720 ? 44 : 54)));
    this.T = w / this.cols;
    this.s = this.T / 54;
    this.rows = Math.ceil(h / this.T);
    // The dining room wall sits about where the content column's veil thins
    // out on wide screens, so the front of house shows on the right.
    this.wallCol = Math.max(
      Math.ceil(this.cols * 0.5),
      Math.min(this.cols - 8, Math.round((w / 2 + 420) / this.T)),
    );
    this.style = {
      kitchenFloor: pick(KITCHEN_FLOORS),
      diningFloor: pick(DINING_FLOORS),
      counter: pick(COUNTERS),
      wall: pick(DINING_WALLS),
      table: pick(TABLE_WOODS),
      cloth: pick(CLOTHS),
      chair: pick(CHAIRS),
      booth: pick(BOOTHS),
      uniform: pick(UNIFORMS),
    };
    this.grid = Array.from({ length: this.rows }, () => Array<Cell | null>(this.cols).fill(null));
    this.layout();
    this.floor = this.paintFloor();
    this.populate();
  }

  // ── Layout ────────────────────────────────────────────

  private layout() {
    const { cols, rows, wallCol: wc } = this;
    for (let col = 0; col < cols; col++) this.place(col, 0, 'wall');
    for (let row = 1; row < rows; row++) this.place(wc, row, 'wall');

    // Cut the pass window and the swing door into the dividing wall.
    const passLen = rows > 10 ? randInt(2, 3) : 2;
    const passRow = randInt(2, Math.max(2, rows - passLen - 4));
    for (let i = 0; i < passLen; i++) this.place(wc, passRow + i, 'pass', { dishes: [] });
    const below = passRow + passLen + randInt(1, 2);
    const above = passRow - randInt(2, 3);
    const doorRow = below < rows - 1 && (above < 1 || Math.random() < 0.6) ? below : Math.max(1, above);
    this.grid[doorRow][wc] = null;
    this.door = { col: wc, row: doorRow, open: 0, swing: 1 };

    this.buildKitchen();
    this.buildDining();
    this.cells = this.grid.flat().filter((c): c is Cell => !!c).sort((a, b) => a.row - b.row);
    this.seats = this.cells.filter((c) => c.station === 'seat');
    this.passes = this.cells.filter((c) => c.station === 'pass');
  }

  private place(col: number, row: number, station: Station, extra: Partial<Cell> = {}) {
    const cell: Cell = { col, row, station, ...extra };
    this.grid[row][col] = cell;
    return cell;
  }

  private clear(x0: number, x1: number, y0: number, y1: number) {
    for (let row = y0; row <= y1; row++) for (let col = x0; col <= x1; col++) this.grid[row][col] = null;
  }

  private buildKitchen() {
    const { rows, wallCol: wc } = this;
    // The column beside the wall stays clear as the aisle to the pass and door.
    const leftWall = Math.random() < 0.65;
    let islands: Cell[][] = [];
    for (let attempt = 0; attempt < 30; attempt++) {
      this.clear(0, wc - 1, 1, rows - 1);
      for (let col = 0; col < wc - 1; col++) this.place(col, 1, 'counter');
      if (leftWall) for (let row = 2; row < rows; row++) this.place(0, row, 'counter');
      // Last try goes without islands, which is always walkable.
      islands = attempt < 29 ? this.islands(leftWall ? 2 : 1, wc - 2 - randInt(0, 1), 3, rows - 2) : [];
      if (this.connected('kitchen')) break;
    }

    // Back line: a run of burners under the hood, with prep space around it.
    const back = this.grid[1].slice(0, wc - 1).filter((c): c is Cell => !!c);
    const range = Math.min(back.length - 1, randInt(2, 5));
    const at = randInt(0, back.length - range);
    back.forEach((c, i) => {
      c.station = i >= at && i < at + range ? 'stove'
        : weighted<Station>([['counter', 40], ['board', 20], ['sink', 12], ['plates', 10]]);
    });
    if (leftWall) {
      for (let row = 2; row < rows; row++) this.grid[row][0]!.station = weighted(LEFT_WALL);
      this.grid[1][0]!.station = 'plates'; // boxed-in corner: just storage
    }
    for (const island of islands) {
      const theme = pick(THEMES);
      for (const c of island) c.station = weighted(theme);
    }

    const kitchen = this.grid.flatMap((r) => r.slice(0, wc))
      .filter((c): c is Cell => !!c && c.station !== 'wall' && !(leftWall && c.col === 0 && c.row === 1));
    // Waiters drop dirty plates at a sink close to the door.
    const toDoor = (t: Tile) => Math.abs(t.col - this.door.col) + Math.abs(t.row - this.door.row);
    if (!kitchen.some((c) => c.station === 'sink' && toDoor(c) <= 4)) {
      const spot = [...kitchen].sort((a, b) => toDoor(a) - toDoor(b)).find((c) => c.station !== 'stove');
      if (spot) spot.station = 'sink';
    }
    // Guarantee the full recipe loop exists somewhere.
    const spares = kitchen.filter((c) => c.station === 'counter' || c.station === 'plates').sort(() => Math.random() - 0.5);
    for (const need of ['crate', 'board', 'stove', 'sink'] as Station[]) {
      if (kitchen.some((c) => c.station === need || (need === 'crate' && c.station === 'fridge'))) continue;
      const spare = spares.pop();
      if (spare) spare.station = need;
    }
    for (const c of kitchen) if (c.station === 'crate' || c.station === 'stove') c.food = pick(FOODS);
  }

  // Counter islands in one of a few arrangements: long rows, columns, or
  // scattered blocks with a walkway all round.
  private islands(x0: number, x1: number, y0: number, y1: number) {
    const out: Cell[][] = [];
    if (x1 - x0 < 1 || y1 - y0 < 1) return out;
    const add = (tiles: Tile[]) => {
      const cells = tiles.filter((t) => !this.grid[t.row][t.col]).map((t) => this.place(t.col, t.row, 'counter'));
      if (cells.length) out.push(cells);
    };
    const plan = pick(['rows', 'rows', 'columns', 'blocks'] as const);
    if (plan === 'blocks') {
      const shapes = [[2, 1], [3, 1], [4, 1], [2, 2], [3, 2], [4, 2], [1, 2], [1, 3], [2, 3], [2, 4]];
      for (let n = 0; n < 60; n++) {
        const [bw, bh] = pick(shapes);
        if (bw > x1 - x0 + 1 || bh > y1 - y0 + 1) continue;
        const col = randInt(x0, x1 - bw + 1);
        const row = randInt(y0, y1 - bh + 1);
        let open = true;
        for (let r = row - 1; r <= row + bh && open; r++) {
          for (let c = col - 1; c <= col + bw; c++) if (this.grid[r][c]) open = false;
        }
        if (!open) continue;
        const tiles: Tile[] = [];
        for (let r = 0; r < bh; r++) for (let c = 0; c < bw; c++) tiles.push({ col: col + c, row: row + r });
        add(tiles);
      }
      return out;
    }
    // Bands stack along `a` and run along `b`.
    const across = plan === 'rows';
    const [a0, a1, b0, b1] = across ? [y0, y1, x0, x1] : [x0, x1, y0, y1];
    const thick = pick([1, 1, 2]);
    for (let a = a0 + randInt(0, 1); a + thick - 1 <= a1; a += thick + randInt(1, 2)) {
      for (let b = b0 + randInt(0, 1); b <= b1;) {
        const len = across ? randInt(3, 7) : randInt(2, 5);
        const tiles: Tile[] = [];
        for (let i = 0; i < len && b + i <= b1; i++) {
          for (let t = 0; t < thick; t++) tiles.push(across ? { col: b + i, row: a + t } : { col: a + t, row: b + i });
        }
        add(tiles);
        b += len + randInt(1, 2);
      }
    }
    return out;
  }

  private buildDining() {
    const { cols, rows, wallCol: wc } = this;
    const x0 = wc + 2; // wc + 1 is the aisle in front of the pass
    const booths = cols - x0 < 3 || Math.random() < 0.45;
    const entRow = randInt(Math.max(2, Math.floor(rows * 0.45)), Math.max(2, rows - 2));
    this.entrance = { col: cols - 1, row: entRow };
    for (let attempt = 0; attempt < 30; attempt++) {
      this.clear(wc + 1, cols - 1, 1, rows - 1);
      if (booths) {
        for (let row = 2; row + 2 <= rows - 2; row += 4) {
          if (Math.abs(row + 1 - entRow) > 2) this.placeSet(BOOTH, cols - 1, row, true);
        }
      }
      if (attempt < 29) this.tables(x0, booths ? cols - 3 : cols - 1, 2, rows - 2);
      for (const col of [x0, cols - 1]) if (!this.grid[1][col] && Math.random() < 0.7) this.place(col, 1, 'plant');
      if (!this.grid[entRow - 1][cols - 1] && Math.random() < 0.7) this.place(cols - 1, entRow - 1, 'podium');
      if (this.connected('dining')) break;
    }
  }

  // Tables laid out in rows; each row picks one of the run's two table styles.
  private tables(x0: number, x1: number, y0: number, y1: number) {
    const fits = TABLE_SETS.filter((set) => footprint(set).w <= x1 - x0 + 1);
    if (!fits.length) return;
    const menu = [pick(fits), pick(fits)];
    const gx = randInt(1, 2);
    const gy = pick([1, 1, 2]);
    const stagger = Math.random() < 0.4;
    for (let y = y0 + randInt(0, 1), i = 0; ; i++) {
      const set = pick(menu);
      const { w, h } = footprint(set);
      if (y + h - 1 > y1) break;
      for (let x = x0 + (stagger && i % 2 ? Math.ceil((w + gx) / 2) : randInt(0, 1)); x + w - 1 <= x1; x += w + gx) {
        if (Math.random() > 0.1) this.placeSet(set, x, y);
        else if (!this.grid[y + (h >> 1)][x + (w >> 1)]) this.place(x + (w >> 1), y + (h >> 1), 'plant');
      }
      y += h + gy;
    }
  }

  private placeSet(set: Piece[], x: number, y: number, booth = false) {
    const ent = this.entrance;
    const ok = set.every(({ dx, dy }) => {
      const col = x + dx;
      const row = y + dy;
      return row > 0 && row < this.rows && col > this.wallCol + 1 && col < this.cols && !this.grid[row][col]
        && Math.max(Math.abs(col - ent.col), Math.abs(row - ent.row)) > 1;
    });
    if (!ok) return;
    const group = this.nextGroup++;
    for (const p of set) this.place(x + p.dx, y + p.dy, p.station, { group, face: p.face, booth });
  }

  private walkable(col: number, row: number, zone: Zone) {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows || this.grid[row][col]) return false;
    return zone === 'staff' || (zone === 'kitchen' ? col < this.wallCol : col > this.wallCol);
  }

  // All floor in the zone is one connected area, and everything people use
  // has floor beside it.
  private connected(zone: 'kitchen' | 'dining') {
    const { cols, rows, wallCol: wc } = this;
    const inZone = (col: number) => (zone === 'kitchen' ? col < wc : col > wc);
    const seen = new Uint8Array(cols * rows);
    let start = -1;
    let floor = 0;
    for (let row = 1; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!inZone(col) || this.grid[row][col]) continue;
        floor++;
        if (start < 0) start = row * cols + col;
      }
    }
    if (start < 0) return false;
    seen[start] = 1;
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      const col = queue[head] % cols;
      const row = (queue[head] - col) / cols;
      for (const [dc, dr] of STEPS) {
        const i = (row + dr) * cols + col + dc;
        if (this.walkable(col + dc, row + dr, zone) && !seen[i]) {
          seen[i] = 1;
          queue.push(i);
        }
      }
    }
    if (queue.length !== floor) return false;
    for (let row = 1; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = this.grid[row][col];
        if (!inZone(col) || !cell || ['wall', 'table', 'plant', 'podium'].includes(cell.station)) continue;
        if (col === 0 && row === 1) continue; // the back corner is boxed in when both walls have counters
        const reached = STEPS.some(([dc, dr]) => {
          const c = col + dc;
          const r = row + dr;
          return c >= 0 && r >= 0 && c < cols && r < rows && seen[r * cols + c];
        });
        if (!reached) return false;
      }
    }
    return true;
  }

  // BFS to the first floor tile that satisfies `goal`; excludes the start tile.
  private route(from: Tile, zone: Zone, goal: (col: number, row: number) => boolean): Tile[] | null {
    const { cols } = this;
    const prev = new Int32Array(cols * this.rows).fill(-1);
    const start = from.row * cols + from.col;
    prev[start] = start;
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head];
      const col = i % cols;
      const row = (i - col) / cols;
      if (goal(col, row)) {
        const path: Tile[] = [];
        for (let j = i; j !== start; j = prev[j]) path.unshift({ col: j % cols, row: Math.floor(j / cols) });
        return path;
      }
      for (const [dc, dr] of STEPS) {
        const nc = col + dc;
        const nr = row + dr;
        if (this.walkable(nc, nr, zone) && prev[nr * cols + nc] === -1) {
          prev[nr * cols + nc] = i;
          queue.push(nr * cols + nc);
        }
      }
    }
    return null;
  }

  private randomFloor(zone: Zone): Tile | null {
    for (let n = 0; n < 400; n++) {
      const col = randInt(0, this.cols - 1);
      const row = randInt(1, this.rows - 1);
      if (this.walkable(col, row, zone)) return { col, row };
    }
    return null;
  }

  // ── Cast ──────────────────────────────────────────────

  private spawn(role: Role, col: number, row: number): Actor {
    return {
      role,
      species: pick(Object.keys(SPECIES) as Species[]),
      shirt: role === 'waiter' ? this.style.uniform : pick(SHIRTS),
      hat: role === 'chef' ? 'toque' : role === 'waiter' ? 'none' : pick(['none', 'none', 'bow', 'cap', 'beret'] as const),
      hatColor: pick(HAT_COLORS),
      seed: Math.random() * 100,
      x: (col + 0.5) * this.T,
      y: (row + FEET) * this.T,
      path: [],
      dir: 'down',
      phase: 0,
      dashing: false,
      task: null,
      working: 0,
      held: null,
      washNext: false,
      pause: rand(0, 1.5),
      emote: null,
      timer: 0,
      meal: 0,
      load: 0,
    };
  }

  // Open mid-service: cooks carrying things, most tables taken, some to clear.
  private populate() {
    let kitchenFloor = 0;
    for (let row = 1; row < this.rows; row++) {
      for (let col = 0; col < this.wallCol; col++) if (!this.grid[row][col]) kitchenFloor++;
    }
    const species = Object.keys(SPECIES) as Species[];
    const forms: Held[] = [null, ...FOODS.flatMap((food) => (['raw', 'chopped', 'soup'] as const).map((form) => ({ form, food })))];
    const chefs = Math.max(3, Math.min(16, Math.round(kitchenFloor / 24)));
    for (let i = 0; i < chefs; i++) {
      const t = this.randomFloor('kitchen');
      if (!t) break;
      const c = this.spawn('chef', t.col, t.row);
      c.species = species[i % species.length];
      c.shirt = SHIRTS[i % SHIRTS.length];
      c.held = pick(forms);
      this.actors.push(c);
    }
    const waiters = Math.max(1, Math.min(8, Math.round(this.seats.length / 5)));
    for (let i = 0; i < waiters; i++) {
      const t = this.randomFloor('dining');
      if (!t) break;
      const w = this.spawn('waiter', t.col, t.row);
      if (Math.random() < 0.4) w.held = { form: 'dish', food: pick(FOODS) };
      this.actors.push(w);
    }
    for (const seat of this.seats) {
      const r = Math.random();
      if (r < 0.55) this.seatGuest(seat, Math.random() < 0.5);
      else if (r < 0.7) seat.plate = 'dirty';
    }
    for (const p of this.passes) p.dishes = Array.from({ length: randInt(0, 2) }, () => pick(FOODS));
    this.nextGuest = rand(0.5, 2);
  }

  private seatGuest(seat: Cell, eating: boolean) {
    const g = this.spawn('guest', seat.col, seat.row);
    g.seat = seat;
    seat.guest = g;
    g.dir = seat.face ?? 'down';
    g.order = pick(FOODS);
    g.pause = 0;
    if (eating) {
      g.mood = 'eating';
      g.meal = rand(8, 14);
      g.timer = rand(0, g.meal * 0.8);
      seat.plate = { food: g.order, eaten: 0 };
    } else {
      g.mood = 'waiting';
      g.timer = rand(0, 8);
    }
    this.actors.push(g);
  }

  // A new party walks in the front door and heads for a free, clean seat.
  private admitGuest() {
    const free = this.seats.filter((st) => !st.guest && !st.plate);
    // The host holds the door when the floor staff are already swamped.
    const hungry = this.actors.filter((a) => a.mood === 'arriving' || a.mood === 'waiting').length;
    const staff = this.actors.filter((a) => a.role === 'waiter').length;
    if (!free.length || hungry > staff * 3) return;
    const st = pick(free);
    const ent = this.entrance;
    const path = this.route(ent, 'dining', beside(st));
    if (!path) return;
    const g = this.spawn('guest', this.cols, ent.row);
    g.mood = 'arriving';
    g.seat = st;
    st.guest = g;
    g.pause = 0;
    g.dir = 'left';
    g.path = [ent, ...path, st];
    this.actors.push(g);
  }

  // ── Simulation ────────────────────────────────────────

  step(dt: number) {
    this.time += dt;
    if ((this.nextGuest -= dt) <= 0) {
      this.nextGuest = rand(1.2, 3.5);
      this.admitGuest();
    }
    for (const a of this.actors) this.stepActor(a, dt);
    this.actors = this.actors.filter((a) => !a.gone);
    this.stepStations(dt);
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'bit') p.vy += 260 * this.s * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0).slice(-300);
  }

  private stepActor(a: Actor, dt: number) {
    const { T, s } = this;
    if (a.emote && (a.emote.t -= dt) <= 0) a.emote = null;
    if (!a.emote && Math.random() < dt * 0.03) a.emote = { text: pick(EMOTES), t: 1.6 };
    if (a.role === 'guest') this.stepGuest(a, dt);
    if (a.pause > 0) {
      a.pause -= dt;
      return;
    }

    if (a.path.length) {
      const next = a.path[0];
      const tx = (next.col + 0.5) * T;
      const ty = (next.row + FEET) * T;
      const dx = tx - a.x;
      const dy = ty - a.y;
      const dist = Math.hypot(dx, dy);
      const pace = a.role === 'guest' ? 1.6 : a.dashing ? 4.2 : a.role === 'waiter' ? 2.6 : 2.3;
      const stride = T * pace * dt;
      if (dist > 0.5) a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      if (dist <= stride) {
        a.x = tx;
        a.y = ty;
        a.path.shift();
      } else {
        a.x += (dx / dist) * stride;
        a.y += (dy / dist) * stride;
      }
      a.phase += dt * (a.dashing ? 24 : 14);
      if (a.dashing && Math.random() < dt * 30) this.puff('dust', a.x, a.y - 2 * s, '#f3e2c7');
      if (!a.path.length) this.arrive(a);
      return;
    }

    if (a.role === 'guest') return;
    if (a.task && a.working > 0) {
      this.work(a, a.task, dt);
      if ((a.working -= dt) <= 0) this.finish(a, a.task);
      return;
    }
    if (a.role === 'chef') this.assignChef(a);
    else this.assignWaiter(a);
  }

  private stepGuest(g: Actor, dt: number) {
    g.timer += dt;
    if (g.mood === 'waiting' && g.timer > 20 && !g.emote && Math.random() < dt * 0.3) {
      g.emote = { text: pick(['…', '!', '?']), t: 1.6 };
    }
    const plate = g.seat?.plate;
    if (g.mood === 'eating' && plate) {
      if (plate !== 'dirty') plate.eaten = Math.min(1, g.timer / g.meal);
      if (g.timer >= g.meal) this.leave(g);
    }
  }

  private leave(g: Actor) {
    const st = g.seat!;
    const { s } = this;
    st.plate = 'dirty';
    st.guest = undefined;
    g.seat = undefined;
    g.mood = 'leaving';
    g.emote = { text: pick(['♥', '♪']), t: 1.4 };
    g.pause = rand(0.3, 0.8);
    const { x, y } = this.center(st);
    this.particles.push({ kind: 'text', x, y: y - 40 * s, vx: 0, vy: -30 * s, life: 1.2, max: 1.2, size: 12 * s, text: '+tip', color: '#c48a12' });
    const ent = this.entrance;
    const path = this.route(st, 'dining', (col, row) => col === ent.col && row === ent.row);
    if (path) g.path = [...path, { col: this.cols, row: ent.row }];
    else g.gone = true;
  }

  private tileOf(a: Actor): Tile {
    return { col: Math.floor(a.x / this.T), row: Math.floor(a.y / this.T) };
  }

  private kind(station: Station) {
    return this.cells.filter((c) => c.station === station);
  }

  // Head for the nearest reachable target, shuffled a little so the crew spreads out.
  private goTo(a: Actor, targets: Cell[], zone: Zone, side?: (col: number) => boolean) {
    const here = this.tileOf(a);
    const free = targets.filter((st) => !st.user);
    const near = (free.length ? free : targets)
      .map((st) => ({ st, d: Math.abs(st.col - here.col) + Math.abs(st.row - here.row) + rand(0, 4) }))
      .sort((p, q) => p.d - q.d);
    for (const { st } of near) {
      const next = beside(st);
      const path = this.route(here, zone, side ? (col, row) => next(col, row) && side(col) : next);
      if (!path) continue;
      a.task = st;
      st.user = a;
      a.path = path;
      a.dashing = path.length > 5 && Math.random() < 0.35;
      if (a.dashing) a.emote = { text: '!', t: 0.9 };
      if (!path.length) this.arrive(a);
      return true;
    }
    return false;
  }

  private assignChef(c: Actor) {
    let targets: Cell[];
    if (!c.held) {
      const sinks = this.kind('sink');
      const dirty = sinks.filter((st) => st.dirty);
      targets = c.washNext ? (dirty.length ? dirty : sinks)
        : this.cells.filter((st) => st.station === 'crate' || st.station === 'fridge');
    } else if (c.held.form === 'raw') targets = this.kind('board');
    else if (c.held.form === 'chopped') targets = this.kind('stove');
    else {
      const least = Math.min(...this.passes.map((p) => p.dishes!.length));
      targets = this.passes.filter((p) => p.dishes!.length === least);
    }
    if (!this.goTo(c, targets, 'kitchen')) c.pause = 1;
  }

  private assignWaiter(w: Actor) {
    if (w.held?.form === 'dirty') {
      // Bus a few more nearby tables before the trip back to the sink.
      const here = this.tileOf(w);
      const more = this.seats.filter((st) => st.plate === 'dirty' && !st.user
        && Math.abs(st.col - here.col) + Math.abs(st.row - here.row) <= 5);
      if (w.load < 3 && more.length && this.goTo(w, more, 'staff')) return;
      if (!this.goTo(w, this.kind('sink'), 'staff')) w.pause = 1;
      return;
    }
    const hungry = this.seats.filter((st) => st.guest?.mood === 'waiting' && !st.user);
    if (w.held) {
      const food = w.held.food;
      const theirs = hungry.filter((st) => st.guest!.order === food);
      if (!this.goTo(w, theirs.length ? theirs : hungry, 'staff')) this.wander(w);
      return;
    }
    // Only fetch from the pass if there's someone left without a plate coming.
    const fetching = this.actors.filter((a) => a.role === 'waiter'
      && (a.task?.station === 'pass' || (a.held?.form === 'dish' && !a.task))).length;
    const ready = this.passes.filter((p) => p.dishes!.length);
    const dirty = this.seats.filter((st) => st.plate === 'dirty' && !st.user);
    const front = (col: number) => col > this.wallCol;
    if (hungry.length > fetching && ready.length && (!dirty.length || Math.random() < 0.65)
      && this.goTo(w, ready, 'staff', front)) return;
    if (dirty.length && this.goTo(w, dirty, 'staff')) return;
    this.wander(w);
  }

  // Nothing to do: drift to another spot on the floor and look busy.
  private wander(w: Actor) {
    w.task = null;
    w.dashing = false;
    const spot = this.randomFloor('dining');
    const path = spot && this.route(this.tileOf(w), 'staff', (col, row) => col === spot.col && row === spot.row);
    if (path?.length) w.path = path;
    else w.pause = rand(0.8, 2);
  }

  private arrive(a: Actor) {
    a.dashing = false;
    if (a.role === 'guest') {
      if (a.mood === 'leaving') a.gone = true;
      else if (a.seat) {
        a.mood = 'waiting';
        a.timer = 0;
        a.dir = a.seat.face ?? 'down';
      }
      return;
    }
    const st = a.task;
    if (!st) {
      a.pause = rand(1, 3);
      a.dir = pick(['down', 'left', 'right'] as const);
      return;
    }
    const { col, row } = this.tileOf(a);
    a.dir = st.row < row ? 'up' : st.row > row ? 'down' : st.col < col ? 'left' : 'right';
    a.working = a.role === 'waiter' ? rand(0.4, 0.7) : WORK_TIME[st.station] * rand(0.85, 1.2);
  }

  private work(a: Actor, st: Cell, dt: number) {
    const { x, y } = this.center(st);
    if (st.station === 'board' && a.held && Math.random() < dt * 9) {
      this.particles.push({
        kind: 'bit', x: x + rand(-6, 6) * this.s, y, vx: rand(-40, 40) * this.s, vy: rand(-110, -60) * this.s,
        life: 0.5, max: 0.5, size: rand(2, 3.5) * this.s, color: FOOD_COLOR[a.held.food],
      });
    }
    if (st.station === 'sink' && a.role === 'chef' && Math.random() < dt * 8) this.puff('bubble', x + rand(-10, 10) * this.s, y);
  }

  private finish(a: Actor, st: Cell) {
    if (st.user === a) st.user = undefined;
    a.task = null;
    a.pause = rand(0.1, 0.4);
    const { x, y } = this.center(st);
    const { s } = this;
    switch (st.station) {
      case 'crate':
        a.held = { form: 'raw', food: st.food ?? 'tomato' };
        break;
      case 'fridge':
        a.held = { form: 'raw', food: pick(FOODS) };
        break;
      case 'board':
        if (a.held) a.held = { ...a.held, form: 'chopped' };
        break;
      case 'stove':
        if (a.held) {
          st.food = a.held.food;
          a.held = { ...a.held, form: 'soup' };
        }
        break;
      case 'pass': {
        const dishes = st.dishes!;
        if (a.role === 'waiter') {
          const food = dishes.shift();
          if (food) a.held = { form: 'dish', food };
          break;
        }
        if (a.held) dishes.push(a.held.food);
        if (dishes.length > 3) dishes.shift();
        a.held = null;
        a.washNext = Math.random() < (this.kind('sink').some((k) => k.dirty) ? 0.6 : 0.1);
        this.burst(x, y, 4);
        if (Math.random() < 0.25) {
          this.particles.push({ kind: 'text', x, y: y - 10 * s, vx: 0, vy: -30 * s, life: 1.1, max: 1.1, size: 10 * s, text: 'order up!', color: '#d9482b' });
        }
        break;
      }
      case 'seat': {
        const g = st.guest;
        if (a.held?.form === 'dish' && g?.mood === 'waiting') {
          st.plate = { food: a.held.food, eaten: 0 };
          a.held = null;
          g.mood = 'eating';
          g.timer = 0;
          g.meal = rand(7, 13);
          g.emote = { text: '♥', t: 1.2 };
          this.burst(x, y, 5);
          this.particles.push({ kind: 'text', x, y: y - 10 * s, vx: 0, vy: -36 * s, life: 1.2, max: 1.2, size: 13 * s, text: '+1', color: '#3f9a5a' });
          if (Math.random() < 0.5) a.emote = { text: '♪', t: 1.2 };
        } else if ((!a.held || a.held.form === 'dirty') && st.plate === 'dirty') {
          st.plate = undefined;
          a.held = { form: 'dirty', food: 'tomato' };
          a.load++;
        }
        break;
      }
      case 'sink':
        if (a.role === 'waiter') {
          if (a.held?.form === 'dirty') st.dirty = Math.min(6, (st.dirty ?? 0) + a.load);
          a.held = null;
          a.load = 0;
        } else {
          a.washNext = false;
          if (st.dirty) st.dirty--;
        }
        break;
    }
  }

  private burst(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.particles.push({
        kind: 'star', x, y, vx: Math.cos(a) * 60 * this.s, vy: Math.sin(a) * 60 * this.s - 30 * this.s,
        life: 0.8, max: 0.8, size: 5 * this.s, color: '#ffd54f',
      });
    }
  }

  private stepStations(dt: number) {
    const { T, s } = this;
    for (const st of this.cells) {
      if (st.station !== 'stove') continue;
      const u = st.user;
      const busy = !!u && u.task === st && u.working > 0;
      if (Math.random() < dt * (busy ? 7 : 1.5)) {
        const { x, y } = this.center(st);
        this.puff('steam', x + rand(-6, 6) * s, y - 6 * s);
      }
    }
    for (const a of this.actors) {
      const hot = a.held?.form === 'soup' || a.held?.form === 'dish';
      if (hot && Math.random() < dt * 1.5) this.puff('steam', a.x, a.y - (a.role === 'waiter' ? 40 : 26) * s);
    }
    // The swing door opens away from whoever's pushing through it.
    const d = this.door;
    const dx = (d.col + 0.5) * T;
    const dy = (d.row + 0.5) * T;
    const by = this.actors.find((a) => a.role === 'waiter' && Math.abs(a.x - dx) < T * 1.1 && Math.abs(a.y - dy) < T * 0.8);
    if (by && d.open < 0.1) d.swing = by.x < dx ? 1 : -1;
    d.open += ((by ? 1 : 0) - d.open) * Math.min(1, dt * (by ? 12 : 4));
  }

  private puff(kind: 'steam' | 'dust' | 'bubble', x: number, y: number, color?: string) {
    const { s } = this;
    const spec = {
      steam: { vy: -28, life: 1.6, size: 4 },
      dust: { vy: -10, life: 0.45, size: 3.5 },
      bubble: { vy: -18, life: 0.7, size: 2.5 },
    }[kind];
    this.particles.push({
      kind, x, y, vx: rand(-8, 8) * s, vy: spec.vy * s * rand(0.7, 1.3),
      life: spec.life, max: spec.life, size: spec.size * s * rand(0.8, 1.3), color,
    });
  }

  private center(st: Tile) {
    return { x: (st.col + 0.5) * this.T, y: (st.row + 0.42) * this.T };
  }

  // ── Rendering ─────────────────────────────────────────

  draw() {
    const { ctx, dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.floor, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const st of this.cells) {
      if (st.station === 'stove') this.drawPot(st);
      else if (st.station === 'pass') this.drawPass(st);
      else if (st.station === 'sink' && st.dirty) this.drawSinkStack(st);
      else if (st.station === 'seat' && st.plate) this.drawTablePlate(st);
    }
    this.drawDoor();
    for (const p of this.particles) if (p.kind !== 'text' && p.kind !== 'star') this.drawParticle(p);
    for (const a of [...this.actors].sort((p, q) => p.y - q.y)) this.drawActor(a);
    for (const p of this.particles) if (p.kind === 'text' || p.kind === 'star') this.drawParticle(p);
    for (const a of this.actors) this.drawBubble(a);
  }

  private paintFloor() {
    const { T, s, w, h, dpr, wallCol: wc, style } = this;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    this.paintRegion(ctx, style.kitchenFloor, 0, wc * T);
    this.paintRegion(ctx, style.diningFloor, (wc + 1) * T, w);

    // Doormat at the front door, threshold under the swing door.
    const ent = this.entrance;
    ctx.fillStyle = '#7a4a2e';
    ctx.beginPath();
    ctx.roundRect(ent.col * T + T * 0.08, ent.row * T + T * 0.1, T * 0.84, T * 0.8, 4 * s);
    ctx.fill();
    ctx.fillStyle = 'rgb(255 255 255 / 12%)';
    for (let i = 1; i < 5; i++) ctx.fillRect(ent.col * T + T * 0.08 + (i * T * 0.84) / 5, ent.row * T + T * 0.16, 1.5 * s, T * 0.68);
    ctx.fillStyle = '#b9a588';
    ctx.fillRect(this.door.col * T + T * 0.2, this.door.row * T, T * 0.6, T);

    for (const cell of this.cells) this.paintCell(ctx, cell);
    return canvas;
  }

  private paintRegion(ctx: CanvasRenderingContext2D, floor: Floor, x0: number, x1: number) {
    const { T, h } = this;
    const [a, b, c] = floor.colors;
    const q = T / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, 0, x1 - x0, h);
    ctx.clip();
    const tiles = (fn: (x: number, y: number, i: number, j: number) => void) => {
      for (let j = 0; j * q < h; j++) for (let i = Math.floor(x0 / q); i * q < x1; i++) fn(i * q, j * q, i, j);
    };
    switch (floor.pattern) {
      case 'checker':
        tiles((x, y, i, j) => {
          ctx.fillStyle = (i + j) % 2 ? b : a;
          ctx.fillRect(x, y, q, q);
        });
        break;
      case 'tile':
        ctx.fillStyle = b;
        ctx.fillRect(x0, 0, x1 - x0, h);
        tiles((x, y) => {
          ctx.fillStyle = a;
          ctx.fillRect(x + 1, y + 1, q - 2, q - 2);
          ctx.fillStyle = `rgb(255 255 255 / ${rand(0, 12)}%)`;
          ctx.fillRect(x + 1, y + 1, q - 2, q - 2);
        });
        break;
      case 'parquet':
        tiles((x, y, i, j) => {
          for (let k = 0; k < 3; k++) {
            ctx.fillStyle = floor.colors[(k + i + j) % 2];
            if ((i + j) % 2) ctx.fillRect(x, y + (k * q) / 3, q, q / 3);
            else ctx.fillRect(x + (k * q) / 3, y, q / 3, q);
          }
          ctx.fillStyle = 'rgb(90 50 20 / 25%)';
          ctx.fillRect(x, y, q, 1);
          ctx.fillRect(x, y, 1, q);
        });
        break;
      case 'carpet':
        ctx.fillStyle = a;
        ctx.fillRect(x0, 0, x1 - x0, h);
        for (let y = 0; y < h; y += T) {
          for (let x = Math.floor(x0 / T) * T; x < x1; x += T) {
            ctx.fillStyle = b;
            ctx.beginPath();
            ctx.moveTo(x + T / 2, y + T * 0.2);
            ctx.lineTo(x + T * 0.8, y + T / 2);
            ctx.lineTo(x + T / 2, y + T * 0.8);
            ctx.lineTo(x + T * 0.2, y + T / 2);
            ctx.fill();
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(x + T / 2, y + T / 2, T * 0.05, 0, Math.PI * 2);
            ctx.arc(x, y, T * 0.04, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      case 'planks': {
        const plank = T / 3;
        for (let y = 0; y < h; y += plank) {
          for (let x = x0 - rand(0, T * 2); x < x1;) {
            const len = T * rand(1.5, 4);
            ctx.fillStyle = pick(floor.colors);
            ctx.fillRect(x, y, len, plank);
            ctx.fillStyle = 'rgb(255 255 255 / 7%)';
            ctx.fillRect(x + 6, y + plank * 0.35, len - 12, 1);
            ctx.fillStyle = 'rgb(90 50 20 / 28%)';
            ctx.fillRect(x, y, 1.5, plank);
            x += len;
          }
          ctx.fillStyle = 'rgb(90 50 20 / 22%)';
          ctx.fillRect(x0, y + plank - 1, x1 - x0, 1.5);
        }
        break;
      }
    }
    ctx.restore();
  }

  private paintCell(ctx: CanvasRenderingContext2D, st: Cell) {
    const { T, s, style } = this;
    const X = st.col * T;
    const Y = st.row * T;
    const lip = T * 0.2;
    const cx = X + T / 2;
    const cy = Y + (T - lip) / 2;
    ctx.lineWidth = 2 * s;
    ctx.strokeStyle = INK;

    switch (st.station) {
      case 'wall':
        if (st.row === 0) this.paintBackWall(ctx, st);
        else {
          ctx.fillStyle = '#6d5a4a';
          ctx.fillRect(X + T * 0.18, Y, T * 0.64, T);
          ctx.fillStyle = '#a08a76';
          ctx.fillRect(X + T * 0.22, Y, T * 0.56, T);
        }
        return;
      case 'pass':
        // A steel shelf through the wall, order tickets clipped on the kitchen side.
        ctx.fillStyle = '#8d99a3';
        ctx.fillRect(X + T * 0.08, Y, T * 0.84, T);
        ctx.fillStyle = '#dfe5ea';
        ctx.fillRect(X + T * 0.12, Y, T * 0.76, T);
        ctx.fillStyle = '#fffaf0';
        for (const ty of [0.15, 0.55]) {
          ctx.fillRect(X + T * 0.02, Y + T * ty, T * 0.12, T * 0.24);
          ctx.fillStyle = 'rgb(0 0 0 / 25%)';
          ctx.fillRect(X + T * 0.04, Y + T * (ty + 0.06), T * 0.08, 1);
          ctx.fillRect(X + T * 0.04, Y + T * (ty + 0.12), T * 0.06, 1);
          ctx.fillStyle = '#fffaf0';
        }
        return;
      case 'plant':
        ctx.fillStyle = 'rgb(40 20 5 / 20%)';
        ellipse(ctx, cx, Y + T * 0.82, T * 0.3, T * 0.1);
        ctx.fill();
        ctx.fillStyle = '#c96f4a';
        ctx.beginPath();
        ctx.roundRect(cx - T * 0.2, Y + T * 0.45, T * 0.4, T * 0.38, 4 * s);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#5fae5a';
        for (const [dx, dy, r] of [[-0.14, 0.28, 0.17], [0.15, 0.3, 0.16], [0, 0.14, 0.19], [0, 0.36, 0.15]]) {
          ctx.beginPath();
          ctx.arc(cx + dx * T, Y + dy * T, r * T, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        return;
      case 'podium':
        ctx.fillStyle = shade(style.table, -0.25);
        ctx.fillRect(X + T * 0.2, Y + T * 0.55, T * 0.6, T * 0.25);
        ctx.fillStyle = style.table;
        ctx.beginPath();
        ctx.roundRect(X + T * 0.16, Y + T * 0.2, T * 0.68, T * 0.4, 3 * s);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fffaf0';
        ctx.fillRect(X + T * 0.28, Y + T * 0.27, T * 0.2, T * 0.24);
        ctx.fillRect(X + T * 0.52, Y + T * 0.27, T * 0.2, T * 0.24);
        return;
      case 'table':
        this.paintTable(ctx, st);
        return;
      case 'seat':
        this.paintSeat(ctx, st);
        return;
    }

    // Kitchen counters and appliances.
    const steel = st.station === 'stove';
    ctx.fillStyle = 'rgb(60 30 10 / 18%)';
    ctx.fillRect(X, Y + T, T, T * 0.14);
    if (st.station === 'fridge') {
      ctx.fillStyle = '#c5ced6';
      ctx.fillRect(X + T * 0.04, Y + T - lip, T * 0.92, lip);
      ctx.fillStyle = '#eef3f6';
      ctx.beginPath();
      ctx.roundRect(X + T * 0.04, Y + T * 0.02, T * 0.92, T - lip, 4 * s);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#9aa5ae';
      ctx.fillRect(cx - 0.75 * s, Y + T * 0.08, 1.5 * s, T * 0.66);
      ctx.fillRect(cx - 6 * s, Y + T * 0.3, 2.5 * s, T * 0.2);
      ctx.fillRect(cx + 3.5 * s, Y + T * 0.3, 2.5 * s, T * 0.2);
      for (const [dx, col] of [[-0.3, '#e5533d'], [0.28, '#f7c948']] as const) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(cx + dx * T, Y + T * 0.2, 2.5 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    ctx.fillStyle = steel ? '#3c414b' : style.counter.lip;
    ctx.fillRect(X, Y + T - lip, T, lip);
    ctx.fillStyle = steel ? '#5b6270' : style.counter.top;
    ctx.fillRect(X, Y, T, T - lip);
    if (!steel) {
      ctx.fillStyle = style.counter.seam;
      ctx.fillRect(X + T / 2 - 1, Y, 2, T - lip);
      ctx.fillRect(X, Y + (T - lip) / 2 - 1, T, 2);
    }
    ctx.fillStyle = 'rgb(0 0 0 / 14%)';
    ctx.fillRect(X + T - 1, Y, 1, T);

    switch (st.station) {
      case 'counter':
        if (Math.random() < 0.35) {
          if (Math.random() < 0.4) this.drawPlate(ctx, cx, cy, 11 * s);
          else this.drawFood(ctx, pick(FOODS), cx, cy, 8 * s);
        }
        break;
      case 'stove':
        ctx.fillStyle = '#2b2f36';
        ctx.beginPath();
        ctx.arc(cx, cy, T * 0.34, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e0613a';
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.arc(cx, cy, T * 0.27, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'board':
        ctx.fillStyle = '#e3ad70';
        ctx.beginPath();
        ctx.roundRect(X + T * 0.14, Y + T * 0.1, T * 0.72, T * 0.55, 5 * s);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#c98d4f';
        ctx.fillRect(X + T * 0.24, Y + T * 0.28, T * 0.5, 1.5 * s);
        ctx.fillRect(X + T * 0.3, Y + T * 0.44, T * 0.4, 1.5 * s);
        ctx.fillStyle = '#d0d7dd';
        ctx.fillRect(X + T * 0.62, Y + T * 0.18, T * 0.06, T * 0.38);
        break;
      case 'crate':
        ctx.fillStyle = '#c68642';
        ctx.beginPath();
        ctx.roundRect(X + T * 0.08, Y + T * 0.04, T * 0.84, T * 0.72, 4 * s);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#9c642c';
        ctx.fillRect(X + T * 0.08, Y + T * 0.58, T * 0.84, 2 * s);
        for (const [dx, dy] of [[-8, -3], [7, -5], [0, 4]]) {
          this.drawFood(ctx, st.food ?? 'tomato', cx + dx * s, cy + dy * s - T * 0.04, 7 * s);
        }
        break;
      case 'sink':
        ctx.fillStyle = '#aebfcb';
        ctx.beginPath();
        ctx.roundRect(X + T * 0.12, Y + T * 0.1, T * 0.76, T * 0.56, 7 * s);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#8fc6e8';
        ctx.beginPath();
        ctx.roundRect(X + T * 0.2, Y + T * 0.2, T * 0.6, T * 0.38, 5 * s);
        ctx.fill();
        ctx.fillStyle = '#7d8891';
        ctx.fillRect(cx - 2 * s, Y + T * 0.02, 4 * s, T * 0.16);
        break;
      case 'plates':
        for (let i = 0; i < 4; i++) this.drawPlate(ctx, cx, cy + 6 * s - i * 3.5 * s, 12 * s);
        break;
    }
  }

  // Row 0: white tile and range hoods behind the kitchen; wallpaper,
  // wainscoting and windows in the dining room.
  private paintBackWall(ctx: CanvasRenderingContext2D, st: Cell) {
    const { T, s, wallCol: wc } = this;
    const X = st.col * T;
    if (st.col < wc) {
      ctx.fillStyle = '#f2efe8';
      ctx.fillRect(X, 0, T, T);
      ctx.fillStyle = '#d9d3c7';
      for (let k = 0; k < 4; k++) {
        ctx.fillRect(X, (k * T) / 4, T, 1);
        for (let gx = k % 2 ? T / 4 : 0; gx < T; gx += T / 2) ctx.fillRect(X + gx, (k * T) / 4, 1, T / 4);
      }
      if (this.grid[1][st.col]?.station === 'stove') {
        ctx.fillStyle = '#b8c2ca';
        ctx.fillRect(X, T * 0.3, T, T * 0.7);
        ctx.fillStyle = '#8d99a3';
        ctx.fillRect(X, T * 0.86, T, T * 0.14);
        for (let i = 1; i < 5; i++) ctx.fillRect(X + (i * T) / 5, T * 0.42, 1.5 * s, T * 0.3);
      }
    } else if (st.col > wc) {
      ctx.fillStyle = this.style.wall;
      ctx.fillRect(X, 0, T, T);
      ctx.fillStyle = 'rgb(255 255 255 / 9%)';
      for (let i = 0; i < 4; i++) ctx.fillRect(X + (i * T) / 4, 0, T / 8, T * 0.62);
      ctx.fillStyle = 'rgb(0 0 0 / 20%)';
      ctx.fillRect(X, T * 0.62, T, T * 0.38);
      ctx.fillStyle = 'rgb(255 255 255 / 30%)';
      ctx.fillRect(X, T * 0.62, T, 2 * s);
      if ((st.col - wc) % 3 === 2) {
        ctx.lineWidth = 2 * s;
        ctx.strokeStyle = INK;
        ctx.fillStyle = '#f6efe2';
        ctx.fillRect(X + T * 0.14, T * 0.08, T * 0.72, T * 0.46);
        ctx.strokeRect(X + T * 0.14, T * 0.08, T * 0.72, T * 0.46);
        ctx.fillStyle = '#bfe3f2';
        ctx.fillRect(X + T * 0.2, T * 0.13, T * 0.6, T * 0.36);
        ctx.fillStyle = '#f6efe2';
        ctx.fillRect(X + T * 0.49, T * 0.13, 2 * s, T * 0.36);
        ctx.fillRect(X + T * 0.2, T * 0.3, T * 0.6, 2 * s);
      }
    } else {
      ctx.fillStyle = '#a08a76';
      ctx.fillRect(X, 0, T, T);
    }
    ctx.fillStyle = 'rgb(40 20 5 / 20%)';
    ctx.fillRect(X, T, T, T * 0.12);
  }

  private paintTable(ctx: CanvasRenderingContext2D, st: Cell) {
    const { T, s, style } = this;
    const joined = (dc: number, dr: number) => {
      const n = this.grid[st.row + dr]?.[st.col + dc];
      return n?.station === 'table' && n.group === st.group;
    };
    const inset = T * 0.08;
    const l = st.col * T + (joined(-1, 0) ? 0 : inset);
    const r = (st.col + 1) * T - (joined(1, 0) ? 0 : inset);
    const t = st.row * T + (joined(0, -1) ? 0 : inset);
    const b = (st.row + 1) * T - (joined(0, 1) ? 0 : inset);
    const lip = joined(0, 1) ? 0 : T * 0.12;
    ctx.fillStyle = 'rgb(40 20 5 / 22%)';
    ctx.fillRect(l + 2 * s, b, r - l, T * 0.08);
    ctx.fillStyle = shade(style.table, -0.3);
    ctx.fillRect(l, b - lip, r - l, lip);
    ctx.fillStyle = style.table;
    ctx.fillRect(l, t, r - l, b - t - lip);
    if (style.cloth) {
      ctx.fillStyle = style.cloth === 'check' ? '#fffaf0' : style.cloth;
      ctx.fillRect(l + 2 * s, t + 2 * s, r - l - 4 * s, b - t - lip - 2 * s);
      if (style.cloth === 'check') {
        ctx.fillStyle = 'rgb(214 69 69 / 35%)';
        const k = T / 6;
        for (let x = l + 2 * s; x < r - 2 * s; x += k * 2) ctx.fillRect(x, t + 2 * s, Math.min(k, r - 2 * s - x), b - t - lip - 2 * s);
        for (let y = t + 2 * s; y < b - lip; y += k * 2) ctx.fillRect(l + 2 * s, y, r - l - 4 * s, Math.min(k, b - lip - y));
      }
    }
    // A little flower vase on each table.
    if (!joined(-1, 0) && !joined(0, -1)) {
      const x = (l + r) / 2 + (joined(1, 0) ? T / 2 : 0);
      const y = (t + b - lip) / 2 + (joined(0, 1) ? T / 2 : 0);
      ctx.lineWidth = 1.4 * s;
      ctx.strokeStyle = INK;
      ctx.fillStyle = '#bfe3f2';
      ctx.beginPath();
      ctx.arc(x, y, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = pick(['#ff8fb1', '#f7c948', '#e5533d']);
      ctx.beginPath();
      ctx.arc(x, y - 3 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private paintSeat(ctx: CanvasRenderingContext2D, st: Cell) {
    const { T, s, style } = this;
    const X = st.col * T;
    const Y = st.row * T;
    const [fx, fy] = FACING[st.face ?? 'down'];
    const color = st.booth ? style.booth : style.chair;
    const pad = st.booth ? T * 0.04 : T * 0.2;
    ctx.lineWidth = 1.6 * s;
    ctx.strokeStyle = INK;
    ctx.fillStyle = 'rgb(40 20 5 / 18%)';
    ctx.fillRect(X + pad, Y + T - pad, T - pad * 2, T * 0.08);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(X + pad, Y + pad, T - pad * 2, T - pad * 2, 4 * s);
    ctx.fill();
    ctx.stroke();
    // Backrest on the side away from the table.
    const back = st.booth ? T * 0.26 : T * 0.13;
    const bx = fx < 0 ? X + T - pad - back : fx > 0 ? X + pad : X + pad;
    const by = fy < 0 ? Y + T - pad - back : fy > 0 ? Y + pad : Y + pad;
    ctx.fillStyle = shade(color, -0.25);
    ctx.beginPath();
    ctx.roundRect(bx, by, fx ? back : T - pad * 2, fy ? back : T - pad * 2, 3 * s);
    ctx.fill();
    ctx.stroke();
  }

  private drawPot(st: Cell) {
    const { ctx, s, time } = this;
    const { x, y } = this.center(st);
    const r = this.T * 0.28;
    const flicker = 0.6 + Math.sin(time * 18 + st.col) * 0.2 + Math.random() * 0.2;
    ctx.fillStyle = `rgb(255 140 50 / ${flicker * 0.55})`;
    ctx.beginPath();
    ctx.arc(x, y + 2 * s, r + 4 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2 * s;
    ctx.strokeStyle = INK;
    ctx.fillStyle = '#9aa5ae';
    ctx.fillRect(x - r - 6 * s, y - 2 * s, 12 * s + 2 * r, 4 * s);
    ctx.fillStyle = '#c9d1d8';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = FOOD_COLOR[st.food ?? 'tomato'];
    ctx.beginPath();
    ctx.arc(x, y, r * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgb(255 255 255 / 45%)';
    for (let i = 0; i < 3; i++) {
      const t = (time * 1.4 + i / 3 + st.col * 0.37) % 1;
      const a = i * 2.1 + st.row;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4, (1 + t * 2.5) * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Heat lamps over the pass, and the plates waiting under them.
  private drawPass(st: Cell) {
    const { ctx, T, s, time } = this;
    const X = st.col * T;
    const Y = st.row * T;
    ctx.fillStyle = `rgb(255 170 60 / ${0.22 + Math.sin(time * 3 + st.row) * 0.05})`;
    ctx.fillRect(X + T * 0.12, Y, T * 0.76, T);
    st.dishes!.slice(-3).forEach((food, i) => this.drawHeld({ form: 'dish', food }, X + T / 2, Y + T * (0.2 + i * 0.3), 6.5 * s));
  }

  private drawSinkStack(st: Cell) {
    const { T, s } = this;
    const n = Math.min(st.dirty ?? 0, 4);
    for (let i = 0; i < n; i++) this.drawDirty(st.col * T + T * 0.8, st.row * T + T * 0.6 - i * 3 * s, 8 * s);
  }

  private drawTablePlate(st: Cell) {
    const { ctx, T, s } = this;
    const [fx, fy] = FACING[st.face ?? 'down'];
    const x = (st.col + 0.5 + fx * 0.8) * T;
    const y = (st.row + 0.4 + fy * 0.8) * T;
    const plate = st.plate!;
    if (plate === 'dirty') {
      this.drawDirty(x, y, 9 * s);
      return;
    }
    this.drawPlate(ctx, x, y, 9 * s);
    const left = 1 - plate.eaten * 0.85;
    ctx.fillStyle = FOOD_COLOR[plate.food];
    ellipse(ctx, x, y - 0.5 * s, 5.5 * s * left, 3.6 * s * left);
    ctx.fill();
  }

  private drawDirty(x: number, y: number, r: number) {
    const { ctx, s } = this;
    this.drawPlate(ctx, x, y, r);
    ctx.fillStyle = 'rgb(140 90 50 / 45%)';
    ellipse(ctx, x - r * 0.25, y, r * 0.3, r * 0.15);
    ctx.fill();
    ellipse(ctx, x + r * 0.3, y - r * 0.15, r * 0.15, r * 0.1);
    ctx.fill();
    ctx.fillStyle = '#9aa5ae';
    ctx.fillRect(x - r * 0.1, y - r * 0.5, r * 0.8, 1.4 * s);
  }

  private drawDoor() {
    const { ctx, T, s } = this;
    const d = this.door;
    ctx.save();
    ctx.translate((d.col + 0.5) * T, d.row * T + 2 * s);
    ctx.rotate(-d.swing * d.open * Math.PI * 0.45);
    ctx.lineWidth = 1.8 * s;
    ctx.strokeStyle = INK;
    ctx.fillStyle = '#b07a4a';
    ctx.beginPath();
    ctx.roundRect(-T * 0.09, 0, T * 0.18, T - 4 * s, 3 * s);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#bfe3f2';
    ctx.beginPath();
    ctx.arc(0, T * 0.42, T * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawActor(a: Actor) {
    const { ctx, s, time } = this;
    const sp = SPECIES[a.species];
    const seated = a.mood === 'waiting' || a.mood === 'eating';
    const moving = a.path.length > 0 && a.pause <= 0;
    const working = !moving && (a.working > 0 || a.mood === 'eating');
    const side = a.dir === 'left' || a.dir === 'right';
    const back = a.dir === 'up';
    const bob = moving ? Math.abs(Math.sin(a.phase)) * 2.5 * s : Math.sin(time * 2 + a.seed) * 0.6 * s;
    const step = moving ? Math.sin(a.phase) * 3 * s : 0;
    // Waiters carry plates up on one hand; everyone else holds things in front.
    const tray = a.role === 'waiter' && !!a.held;
    const carry = !!a.held && !back && !tray;

    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.scale(CHEF_SCALE, CHEF_SCALE);
    if (!seated) {
      ctx.fillStyle = 'rgb(40 20 5 / 22%)';
      ellipse(ctx, 0, 0, 13 * s, 5 * s);
      ctx.fill();
    }
    if (a.dir === 'left') ctx.scale(-1, 1);
    ctx.lineWidth = 2.2 * s;
    ctx.strokeStyle = INK;

    if (!seated) {
      ctx.fillStyle = '#4a3a32';
      ellipse(ctx, -5 * s + (side ? step : 0), -2 * s + (side ? 0 : step), 3.5 * s, 2.5 * s);
      ctx.fill();
      ellipse(ctx, 5 * s - (side ? step : 0), -2 * s - (side ? 0 : step), 3.5 * s, 2.5 * s);
      ctx.fill();
    }

    ctx.translate(0, -bob + (seated ? 3 * s : 0));
    if (back && a.held && !tray) this.drawHeld(a.held, 0, -26 * s, 6 * s);

    // Body: chef's whites and apron, waiter's waistcoat and bow tie, or the
    // guest's own clothes.
    const body = new Path2D();
    body.ellipse(0, -14 * s, 11.5 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = a.shirt;
    ctx.stroke(body);
    ctx.fill(body);
    if (!back && a.role === 'chef') {
      ctx.fillStyle = '#fffaf0';
      ctx.beginPath();
      ctx.roundRect(side ? -2 * s : -7 * s, -19 * s, side ? 11 * s : 14 * s, 15 * s, 4 * s);
      ctx.fill();
    } else if (!back && a.role === 'waiter') {
      const mx = side ? 4.5 * s : 0;
      ctx.fillStyle = '#fffaf0';
      ctx.beginPath();
      ctx.moveTo(mx - 4.5 * s, -24.5 * s);
      ctx.lineTo(mx + 4.5 * s, -24.5 * s);
      ctx.lineTo(mx, -10 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#d64545';
      ctx.beginPath();
      ctx.moveTo(mx, -22 * s);
      ctx.lineTo(mx - 3.5 * s, -24.5 * s);
      ctx.lineTo(mx - 3.5 * s, -19.5 * s);
      ctx.closePath();
      ctx.moveTo(mx, -22 * s);
      ctx.lineTo(mx + 3.5 * s, -24.5 * s);
      ctx.lineTo(mx + 3.5 * s, -19.5 * s);
      ctx.closePath();
      ctx.fill();
    }

    // Arms: chopping/stirring/eating jiggle, held forward when carrying, one
    // raised under a waiter's plate.
    const eating = a.mood === 'eating';
    const jiggle = working ? Math.sin(time * (eating ? 9 : 22)) * (eating ? 2 : 3) * s : 0;
    const armX = carry ? 7 * s : 11 * s;
    const armY = carry ? -12 * s : -14 * s;
    const arms = new Path2D();
    circle(arms, -armX, armY + jiggle, 3.6 * s);
    if (tray) circle(arms, 12 * s, -24 * s, 3.6 * s);
    else circle(arms, armX, armY - jiggle, 3.6 * s);
    ctx.fillStyle = sp.fur;
    ctx.stroke(arms);
    ctx.fill(arms);
    if (carry) this.drawHeld(a.held!, side ? 9 * s : 0, -13 * s, 6.5 * s);

    // Head with ears/extras behind it, stroked and filled as one silhouette.
    const head = new Path2D();
    const ears = new Path2D();
    this.earShapes(a.species, ears);
    head.arc(0, -31 * s, 12.5 * s, 0, Math.PI * 2);
    const silhouette = new Path2D(ears);
    silhouette.addPath(head);
    ctx.fillStyle = a.species === 'dog' ? sp.inner : sp.fur;
    ctx.stroke(silhouette);
    ctx.fill(ears);
    this.earInners(a.species);
    ctx.fillStyle = sp.fur;
    ctx.fill(head);

    if (!back) this.drawFace(a.species, side ? 4 * s : 0);
    this.drawHat(a, side, back);

    if (a.species === 'frog') {
      for (const ex of [-8.5, 8.5]) {
        ctx.fillStyle = sp.fur;
        ctx.beginPath();
        ctx.arc(ex * s, -39 * s, 5 * s, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();
        if (!back) {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(ex * s + (side ? 1.5 * s : 0), -39 * s, 3.2 * s, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#2b1d16';
          ctx.beginPath();
          ctx.arc(ex * s + (side ? 2.5 * s : 0), -38.5 * s, 1.8 * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    if (tray) this.drawHeld(a.held!, 14 * s, -29 * s, 7 * s);
    ctx.restore();
  }

  private drawHat(a: Actor, side: boolean, back: boolean) {
    const { ctx, s } = this;
    ctx.fillStyle = a.hatColor;
    switch (a.hat) {
      case 'toque': {
        const hat = new Path2D();
        hat.roundRect(-9 * s, -47 * s, 18 * s, 7 * s, 2 * s);
        circle(hat, -6 * s, -50 * s, 5.5 * s);
        circle(hat, 6 * s, -50 * s, 5.5 * s);
        circle(hat, 0, -54 * s, 7 * s);
        ctx.fillStyle = '#ffffff';
        ctx.stroke(hat);
        ctx.fill(hat);
        break;
      }
      case 'cap':
        ctx.beginPath();
        ctx.arc(0, -33 * s, 13 * s, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        if (!back) {
          ellipse(ctx, side ? 11 * s : 0, -33 * s, side ? 8 * s : 10 * s, 2.6 * s);
          ctx.fill();
          ctx.stroke();
        }
        break;
      case 'beret':
        ctx.beginPath();
        ctx.ellipse(-2 * s, -42 * s, 12 * s, 5 * s, -0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillRect(-3 * s, -49 * s, 2 * s, 3 * s);
        break;
      case 'bow': {
        const bx = 7 * s;
        const by = -42 * s;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - 6 * s, by - 4 * s);
        ctx.lineTo(bx - 6 * s, by + 4 * s);
        ctx.closePath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + 6 * s, by - 4 * s);
        ctx.lineTo(bx + 6 * s, by + 4 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
    }
  }

  private earShapes(species: Species, p: Path2D) {
    const { s } = this;
    const oval = (x: number, y: number, rx: number, ry: number, rot: number) => {
      const q = new Path2D();
      q.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
      p.addPath(q);
    };
    for (const m of [-1, 1]) {
      switch (species) {
        case 'cat':
          p.moveTo(m * 13 * s, -32 * s);
          p.lineTo(m * 13 * s, -46 * s);
          p.lineTo(m * 4 * s, -41 * s);
          p.closePath();
          break;
        case 'pig':
          p.moveTo(m * 12 * s, -35 * s);
          p.lineTo(m * 15 * s, -44 * s);
          p.lineTo(m * 5 * s, -41 * s);
          p.closePath();
          break;
        case 'bear':
          circle(p, m * 10.5 * s, -40 * s, 5 * s);
          break;
        case 'koala':
          circle(p, m * 12.5 * s, -37 * s, 7 * s);
          break;
        case 'bunny':
          oval(m * 11 * s, -49 * s, 3.8 * s, 11 * s, m * 0.4);
          break;
        case 'dog':
          oval(m * 12.5 * s, -30 * s, 4.5 * s, 8.5 * s, m * -0.3);
          break;
        case 'duck':
          if (m === 1) oval(2 * s, -44 * s, 2 * s, 5 * s, 0.4);
          break;
      }
    }
  }

  private earInners(species: Species) {
    const { ctx, s } = this;
    const sp = SPECIES[species];
    ctx.fillStyle = sp.inner;
    for (const m of [-1, 1]) {
      ctx.beginPath();
      if (species === 'cat') {
        ctx.moveTo(m * 11.5 * s, -36 * s);
        ctx.lineTo(m * 11.5 * s, -43 * s);
        ctx.lineTo(m * 7 * s, -40.5 * s);
      } else if (species === 'bear') ctx.arc(m * 10.5 * s, -40 * s, 2.5 * s, 0, Math.PI * 2);
      else if (species === 'koala') ctx.arc(m * 12.5 * s, -37 * s, 4 * s, 0, Math.PI * 2);
      else if (species === 'bunny') ctx.ellipse(m * 11 * s, -50 * s, 1.8 * s, 7.5 * s, m * 0.4, 0, Math.PI * 2);
      else continue;
      ctx.fill();
    }
  }

  private drawFace(species: Species, fx: number) {
    const { ctx, s } = this;
    if (species === 'penguin') {
      ctx.fillStyle = '#fff';
      ellipse(ctx, fx, -29.5 * s, 9 * s, 7.5 * s);
      ctx.fill();
    }
    if (species === 'bear' || species === 'dog') {
      ctx.fillStyle = species === 'bear' ? '#e6c9a8' : '#f6e6cf';
      ellipse(ctx, fx, -27.5 * s, 5.5 * s, 4 * s);
      ctx.fill();
    }
    if (species !== 'frog') {
      for (const ex of [-4.5, 4.5]) {
        ctx.fillStyle = '#2b1d16';
        ctx.beginPath();
        ctx.arc(fx + ex * s, -32 * s, 1.9 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(fx + ex * s + 0.6 * s, -32.7 * s, 0.6 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = 'rgb(255 130 140 / 55%)';
    ellipse(ctx, fx - 8 * s, -27.5 * s, 2.6 * s, 1.6 * s);
    ctx.fill();
    ellipse(ctx, fx + 8 * s, -27.5 * s, 2.6 * s, 1.6 * s);
    ctx.fill();

    ctx.strokeStyle = '#2b1d16';
    ctx.lineWidth = 1.3 * s;
    switch (species) {
      case 'duck':
      case 'penguin':
        ctx.fillStyle = '#f39c34';
        ellipse(ctx, fx, -27.5 * s, species === 'duck' ? 6 * s : 3 * s, species === 'duck' ? 3.2 * s : 2.2 * s);
        ctx.fill();
        break;
      case 'pig':
        ctx.fillStyle = '#f48fa3';
        ellipse(ctx, fx, -27.5 * s, 4.5 * s, 3.2 * s);
        ctx.fill();
        ctx.fillStyle = '#b5566a';
        for (const nx of [-1.6, 1.6]) {
          ellipse(ctx, fx + nx * s, -27.5 * s, 0.9 * s, 1.3 * s);
          ctx.fill();
        }
        break;
      case 'koala':
        ctx.fillStyle = '#3a3440';
        ellipse(ctx, fx, -28.5 * s, 3.2 * s, 4 * s);
        ctx.fill();
        break;
      case 'bear':
      case 'dog':
        ctx.fillStyle = '#2b1d16';
        ellipse(ctx, fx, -29 * s, 2 * s, 1.4 * s);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(fx, -27 * s, 2 * s, 0.2, Math.PI - 0.2);
        ctx.stroke();
        break;
      case 'frog':
        ctx.beginPath();
        ctx.arc(fx, -31 * s, 6 * s, 0.35, Math.PI - 0.35);
        ctx.stroke();
        break;
      default: // cat, bunny: little "w" mouth
        ctx.fillStyle = '#f48fa3';
        ellipse(ctx, fx, -29 * s, 1.4 * s, 1 * s);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(fx - 1.4 * s, -27.6 * s, 1.4 * s, 0.1, Math.PI - 0.1);
        ctx.arc(fx + 1.4 * s, -27.6 * s, 1.4 * s, 0.1, Math.PI - 0.1);
        ctx.stroke();
    }
    ctx.lineWidth = 2.2 * s;
    ctx.strokeStyle = INK;
  }
  private drawHeld(held: NonNullable<Held>, x: number, y: number, r: number) {
    const { ctx, s } = this;
    ctx.save();
    ctx.lineWidth = 1.8 * s;
    ctx.strokeStyle = INK;
    if (held.form === 'raw') this.drawFood(ctx, held.food, x, y, r);
    else if (held.form === 'chopped') {
      ctx.fillStyle = FOOD_COLOR[held.food];
      for (const [dx, dy] of [[-3.5, 1], [3, 2], [0, -2.5]]) {
        ctx.beginPath();
        ctx.roundRect(x + dx * s - 2.5 * s, y + dy * s - 2.5 * s, 5 * s, 5 * s, 1.2 * s);
        ctx.fill();
        ctx.stroke();
      }
    } else if (held.form === 'dish') {
      this.drawPlate(ctx, x, y, r * 1.35);
      ctx.fillStyle = FOOD_COLOR[held.food];
      ellipse(ctx, x, y - r * 0.1, r * 0.8, r * 0.5);
      ctx.fill();
      ctx.fillStyle = '#7cc04b';
      ellipse(ctx, x + r * 0.3, y - r * 0.35, r * 0.22, r * 0.15);
      ctx.fill();
    } else if (held.form === 'dirty') {
      for (let i = 0; i < 3; i++) this.drawDirty(x, y - i * 2.5 * s, r * 1.2);
    } else {
      ctx.fillStyle = '#fffaf0';
      ellipse(ctx, x, y, r * 1.25, r);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = FOOD_COLOR[held.food];
      ellipse(ctx, x, y - r * 0.15, r * 0.9, r * 0.6);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawPlate(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    ctx.save();
    ctx.lineWidth = 1.5 * this.s;
    ctx.strokeStyle = INK;
    ctx.fillStyle = '#fbf8f2';
    ellipse(ctx, x, y, r, r * 0.75);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#ddd5c8';
    ellipse(ctx, x, y, r * 0.65, r * 0.48);
    ctx.stroke();
    ctx.restore();
  }

  private drawFood(ctx: CanvasRenderingContext2D, food: Food, x: number, y: number, r: number) {
    ctx.save();
    ctx.lineWidth = 1.6 * this.s;
    ctx.strokeStyle = INK;
    ctx.fillStyle = FOOD_COLOR[food];
    ctx.beginPath();
    switch (food) {
      case 'mushroom':
        ctx.fillStyle = '#f3e5c8';
        ctx.fillRect(x - r * 0.3, y - r * 0.1, r * 0.6, r * 0.8);
        ctx.strokeRect(x - r * 0.3, y - r * 0.1, r * 0.6, r * 0.8);
        ctx.fillStyle = FOOD_COLOR.mushroom;
        ctx.beginPath();
        ctx.arc(x, y, r, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff3e0';
        for (const [dx, dy, dr] of [[-0.4, -0.45, 0.18], [0.35, -0.55, 0.14]]) {
          ctx.beginPath();
          ctx.arc(x + r * dx, y + r * dy, r * dr, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'cheese':
        ctx.moveTo(x - r, y + r * 0.6);
        ctx.lineTo(x + r, y + r * 0.6);
        ctx.lineTo(x + r * 0.6, y - r * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#d9a520';
        ctx.beginPath();
        ctx.arc(x + r * 0.2, y + r * 0.1, r * 0.18, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'fish':
        ctx.moveTo(x + r * 0.6, y);
        ctx.lineTo(x + r * 1.2, y - r * 0.55);
        ctx.lineTo(x + r * 1.2, y + r * 0.55);
        ctx.closePath();
        ctx.moveTo(x + r * 0.7, y);
        ctx.ellipse(x - r * 0.2, y, r * 0.9, r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#2b1d16';
        ctx.beginPath();
        ctx.arc(x - r * 0.65, y - r * 0.1, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
        break;
      default:
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (food === 'lettuce') {
          ctx.strokeStyle = '#c5e7a4';
          ctx.beginPath();
          ctx.arc(x, y + r * 0.2, r * 0.5, Math.PI * 1.1, Math.PI * 1.9);
          ctx.stroke();
        } else {
          // Tomato leaf / onion sprout
          ctx.fillStyle = food === 'tomato' ? '#4caf50' : '#8bc34a';
          ellipse(ctx, x, y - r * 0.85, r * 0.4, r * 0.22);
          ctx.fill();
          ctx.fillStyle = 'rgb(255 255 255 / 55%)';
          ellipse(ctx, x - r * 0.4, y - r * 0.3, r * 0.2, r * 0.13);
          ctx.fill();
        }
    }
    ctx.restore();
  }

  private drawParticle(p: Particle) {
    const { ctx, s } = this;
    const t = p.life / p.max;
    ctx.globalAlpha = Math.min(1, t * 1.6);
    switch (p.kind) {
      case 'steam':
        ctx.fillStyle = 'rgb(255 255 255 / 70%)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (2 - t), 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'dust':
        ctx.fillStyle = p.color ?? '#fff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - t), 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'bubble':
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2 * s;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'bit':
        ctx.fillStyle = p.color ?? '#fff';
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        break;
      case 'star':
        ctx.fillStyle = p.color ?? '#ffd54f';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2 * s;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI) / 5 - Math.PI / 2;
          const r = i % 2 ? p.size * 0.45 : p.size;
          ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      case 'text':
        ctx.font = `700 ${p.size * 1.2}px 'Playfair Display', Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3 * s;
        ctx.strokeStyle = '#fff';
        ctx.strokeText(p.text ?? '', p.x, p.y);
        ctx.fillStyle = p.color ?? INK;
        ctx.fillText(p.text ?? '', p.x, p.y);
        break;
    }
    ctx.globalAlpha = 1;
  }

  // Speech bubble: a passing emote, or a waiting guest's order.
  private drawBubble(a: Actor) {
    const { ctx, s } = this;
    const order = a.mood === 'waiting' && !a.emote ? a.order : undefined;
    if (!a.emote && !order) return;
    const pop = a.emote ? Math.min(1, (1.6 - a.emote.t) * 8, a.emote.t * 6) : Math.min(1, a.timer * 6);
    const x = a.x + 14 * s;
    const y = a.y - (a.hat === 'toque' ? 66 : 56) * CHEF_SCALE * s;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(Math.max(pop, 0.01), Math.max(pop, 0.01));
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6 * s;
    const bubble = new Path2D();
    bubble.roundRect(-9 * s, -9 * s, 18 * s, 16 * s, 6 * s);
    bubble.moveTo(2 * s, 5 * s);
    bubble.lineTo(-7 * s, 12 * s);
    bubble.lineTo(-4 * s, 5 * s);
    bubble.closePath();
    ctx.stroke(bubble);
    ctx.fill(bubble);
    if (order) this.drawFood(ctx, order, 0, -1 * s, 4.5 * s);
    else if (a.emote) {
      ctx.font = `800 ${11 * s}px 'Playfair Display', Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = a.emote.text === '♥' ? '#e5533d' : a.emote.text === '!' ? '#d9482b' : INK;
      ctx.fillText(a.emote.text, 0, -0.5 * s);
    }
    ctx.restore();
  }
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function circle(p: Path2D, x: number, y: number, r: number) {
  p.moveTo(x + r, y);
  p.arc(x, y, r, 0, Math.PI * 2);
}

// Darken (f < 0) or lighten (f > 0) a #rrggbb colour.
function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f);
  return `rgb(${ch(n >> 16)} ${ch((n >> 8) & 255)} ${ch(n & 255)})`;
}
