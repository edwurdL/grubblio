import { useEffect, useRef } from 'react';
import { Kitchen } from '../kitchen';

// The scene renders at 1/PIXEL resolution and is upscaled with nearest-neighbour
// sampling for a soft pixel-art look.
const PIXEL = 2;

export default function KitchenBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let kitchen: Kitchen;
    let size = { w: 0, h: 0 };
    let raf = 0;
    let last = 0;
    let timer = 0;

    const build = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Mobile URL bars nudge the height while scrolling; don't reshuffle the
      // whole kitchen for that.
      if (w === size.w && Math.abs(h - size.h) < 120) return;
      size = { w, h };
      kitchen = new Kitchen(canvas, w, h, 1 / PIXEL);
      kitchen.draw();
    };
    const frame = (now: number) => {
      kitchen.step(Math.min((now - last) / 1000, 0.05));
      kitchen.draw();
      last = now;
      raf = requestAnimationFrame(frame);
    };
    const onResize = () => {
      clearTimeout(timer);
      timer = window.setTimeout(build, 150);
    };

    build();
    if (!still) {
      raf = requestAnimationFrame((now) => {
        last = now;
        frame(now);
      });
    }
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div className="kitchen-bg" aria-hidden>
      <canvas ref={ref} />
    </div>
  );
}
