import { useId } from 'react';
import { PixelArt } from './Pixel';

const PLATE = [
  '....aaaa....',
  '..aabbbbaa..',
  '.abbbbbbbba.',
  '.abbccccbba.',
  'abbccccccbba',
  'abbccccccbba',
  'abbccccccbba',
  'abbccccccbba',
  '.abbccccbba.',
  '.abbbbbbbba.',
  '..aabbbbaa..',
  '....aaaa....',
];
const PALETTE = { a: '#cdbb9c', b: '#fbf3e3', c: '#e6d6b8' };

// Jagged crack running top to bottom, shared by both halves.
const CRACK = '6,0 7,3 5,5 7,8 6,12';

function PlateArt() {
  return <PixelArt rows={PLATE} palette={PALETTE} />;
}

/** A dinner plate that shatters in two when `broken`. `fresh` plays the break animation. */
export default function Plate({ broken, fresh }: { broken: boolean; fresh: boolean }) {
  const id = useId();
  if (!broken) {
    return (
      <svg className="plate" viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden>
        <PlateArt />
      </svg>
    );
  }
  return (
    <svg className={`plate broken ${fresh ? 'fresh' : ''}`} viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden>
      <defs>
        <clipPath id={`${id}-l`}><polygon points={`0,0 ${CRACK} 0,12`} /></clipPath>
        <clipPath id={`${id}-r`}><polygon points={`${CRACK} 12,12 12,0`} /></clipPath>
      </defs>
      <g className="half half-l"><g clipPath={`url(#${id}-l)`}><PlateArt /></g></g>
      <g className="half half-r"><g clipPath={`url(#${id}-r)`}><PlateArt /></g></g>
    </svg>
  );
}
