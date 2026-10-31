import { useEffect, type RefObject } from 'react';

// A hanging ticket as a damped spring: sideways pointer movement pushes it,
// and it wobbles back to rest. Angles in degrees, time in seconds.
const MAX_ANGLE = 2;
const STIFFNESS = 60;
const DAMPING = 5;
/** Swing speed (deg/s) added per pixel of horizontal pointer movement. */
const PUSH = 0.025;

/**
 * Makes `ref` swing from its transform-origin as the pointer sweeps across it,
 * following the direction of the swipe. Drives the CSS `rotate` property so it
 * stacks with any transform animation already on the element.
 */
export function useSwing(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let angle = 0;
    let velocity = 0;
    let raf = 0;
    let last = 0;

    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.032);
      last = now;
      velocity += (-STIFFNESS * angle - DAMPING * velocity) * dt;
      angle += velocity * dt;
      if (Math.abs(angle) > MAX_ANGLE) {
        angle = Math.sign(angle) * MAX_ANGLE;
        velocity = 0;
      }
      if (Math.abs(angle) < 0.01 && Math.abs(velocity) < 0.05) {
        el.style.rotate = '';
        raf = 0;
        return;
      }
      el.style.rotate = `${angle.toFixed(3)}deg`;
      raf = requestAnimationFrame(step);
    };

    const onMove = (e: PointerEvent) => {
      // It hangs from the top, so swinging the bottom right is a negative angle.
      velocity -= e.movementX * PUSH;
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    };

    el.addEventListener('pointermove', onMove);
    return () => {
      el.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [ref]);
}
