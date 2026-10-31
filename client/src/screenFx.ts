// Full-screen game feel: a shake and red edge flash when a plate breaks (like
// taking a hit), and a shake plus 8-bit confetti for the right answer. Uses the
// Web Animations API and a throwaway canvas so they can replay any time.

const SHAKE: Keyframe[] = [
  { transform: 'translate(0, 0)' },
  { transform: 'translate(-7px, 3px)' },
  { transform: 'translate(6px, -4px)' },
  { transform: 'translate(-5px, -2px)' },
  { transform: 'translate(4px, 3px)' },
  { transform: 'translate(-2px, 1px)' },
  { transform: 'translate(0, 0)' },
];

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function shakeScreen() {
  for (const el of document.querySelectorAll<HTMLElement>('.stage, .kitchen-bg')) {
    el.animate(SHAKE, { duration: 360, easing: 'linear' });
  }
}

export function takeDamage(flash: HTMLElement | null) {
  if (reducedMotion()) return;
  shakeScreen();
  flash?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 480, easing: 'ease-out' });
}

export function celebrate() {
  if (reducedMotion()) return;
  shakeScreen();
  confetti();
}

// Confetti is drawn on a canvas at 1/PIXEL resolution and scaled up with
// nearest-neighbour sampling, so every piece is a chunky square pixel.
const PIXEL = 4;
const COUNT = 160;
const DURATION = 2600;
const COLORS = ['#e5ad37', '#c8382a', '#8cc46b', '#7fa7c9', '#f4ead8', '#e98b4f'];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  spin: number;
  phase: number;
  color: string;
}

function confetti() {
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  const w = Math.ceil(window.innerWidth / PIXEL);
  const h = Math.ceil(window.innerHeight / PIXEL);
  canvas.width = w;
  canvas.height = h;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d')!;

  // Two party poppers in the bottom corners, aimed up and inwards.
  const pieces: Piece[] = Array.from({ length: COUNT }, (_, i) => {
    const left = i % 2 === 0;
    const angle = (-62 + (Math.random() - 0.5) * 30) * (Math.PI / 180);
    const speed = h * (1.2 + Math.random() * 0.9);
    return {
      x: left ? 0 : w,
      y: h,
      vx: Math.cos(angle) * speed * (left ? 1 : -1),
      vy: Math.sin(angle) * speed,
      size: 1 + Math.round(Math.random()),
      spin: 6 + Math.random() * 10,
      phase: Math.random() * Math.PI * 2,
      color: COLORS[i % COLORS.length],
    };
  });

  const gravity = h * 1.5;
  const start = performance.now();
  let last = start;
  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const t = now - start;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = t > DURATION - 500 ? Math.max(0, (DURATION - t) / 500) : 1;
    for (const p of pieces) {
      p.vy += gravity * dt;
      p.vx *= 1 - 1.4 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.phase += p.spin * dt;
      // Tumbling: the piece narrows to a sliver and back as it turns.
      const width = Math.max(1, Math.round(p.size * Math.abs(Math.cos(p.phase)) * 1.5));
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), width, p.size);
    }
    if (t < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
