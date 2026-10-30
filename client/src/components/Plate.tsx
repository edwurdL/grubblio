import { useId } from 'react';

// Jagged crack running top to bottom, shared by both halves.
const CRACK = '16,0 19,8 14,14 18,21 15,32';

function PlateArt() {
  return (
    <>
      <circle cx="16" cy="16" r="14" fill="#fffaf2" stroke="var(--ink)" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="8.5" fill="#f6e8d3" stroke="var(--border)" strokeWidth="1.4" />
    </>
  );
}

/** A dinner plate that shatters in two when `broken`. `fresh` plays the break animation. */
export default function Plate({ broken, fresh }: { broken: boolean; fresh: boolean }) {
  const id = useId();
  if (!broken) {
    return (
      <svg className="plate" viewBox="0 0 32 32" aria-hidden>
        <PlateArt />
      </svg>
    );
  }
  return (
    <svg className={`plate broken ${fresh ? 'fresh' : ''}`} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <clipPath id={`${id}-l`}><polygon points={`0,0 ${CRACK} 0,32`} /></clipPath>
        <clipPath id={`${id}-r`}><polygon points={`${CRACK} 32,32 32,0`} /></clipPath>
      </defs>
      <g className="half half-l"><g clipPath={`url(#${id}-l)`}><PlateArt /></g></g>
      <g className="half half-r"><g clipPath={`url(#${id}-r)`}><PlateArt /></g></g>
    </svg>
  );
}
