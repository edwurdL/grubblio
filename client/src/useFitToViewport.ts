import { useLayoutEffect, type RefObject } from 'react';

// Below this the pixel fonts get too small to read; let the page scroll instead.
const MIN_ZOOM = 0.7;

/**
 * Zooms `ref` out (like pressing Ctrl −) until it fits the viewport height,
 * so the ticket, input and every guess stay on one screen. CSS zoom reflows
 * rather than just shrinking pixels, so the content also gets more width.
 */
export function useFitToViewport(ref: RefObject<HTMLElement | null>, bottomGap = 0) {
  useLayoutEffect(() => {
    const el = ref.current!;
    let raf = 0;

    const fit = () => {
      // Always measure at full size, so the result only depends on the
      // viewport and content, never on the previous zoom.
      el.style.zoom = '';
      const avail = window.innerHeight - bottomGap;
      let zoom = Math.max(MIN_ZOOM, Math.min(1, avail / el.getBoundingClientRect().height));
      // Zooming out widens the content, which can reflow it, so re-measure a
      // couple of times. Only ever zoom further out:
      // zooming back in could undo the reflow and oscillate.
      for (let i = 0; i < 3 && zoom < 1; i++) {
        el.style.zoom = zoom.toFixed(3);
        const visual = el.getBoundingClientRect().height;
        if (visual <= avail + 1 || zoom === MIN_ZOOM) break;
        zoom = Math.max(MIN_ZOOM, zoom * (avail / visual));
      }
      // The background's shaded column follows the (zoomed) play area.
      document.documentElement.style.setProperty('--gutter', `${Math.max(0, el.getBoundingClientRect().left)}px`);
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fit);
    };

    // Content changes (new guess, fonts or photo loading) resize the children.
    const observer = new ResizeObserver(schedule);
    for (const child of el.children) observer.observe(child);
    window.addEventListener('resize', schedule);
    fit();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [ref, bottomGap]);
}
