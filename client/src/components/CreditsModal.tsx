import type { ReactNode } from 'react';
import Modal from './Modal';

const CC_BY_4 = 'https://creativecommons.org/licenses/by/4.0/';
const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
const OFL = 'https://openfontlicense.org/';

// Sounds from freesound.org. Keep in sync with useSound.ts and the README.
const SOUNDS = [
  { use: 'Music', title: 'jazz_music_loop', id: 456797, author: 'NikoSardas', license: 'CC BY 4.0', note: 'Playback speed is changed during play.' },
  { use: 'Plate breaking', title: 'Plate-5', id: 381264, author: 'edwar64896', license: 'CC BY 4.0' },
  { use: 'Page turn', title: 'Page Turn - Please Turn Over (PTO)', id: 63318, author: 'flag2', license: 'CC BY 4.0' },
  { use: 'Right answer', title: 'Bite (Cartoon Style)', id: 353067, author: 'Jofae', license: 'CC0' },
  { use: 'Last plate broken', title: 'Glass', id: 536763, author: 'egomassive', license: 'CC0' },
];

const PHOTO_SOURCES = [
  { name: 'Wikimedia Commons', url: 'https://commons.wikimedia.org/', terms: 'Each photo under its own Creative Commons licence' },
  { name: 'Pixabay', url: 'https://pixabay.com/', terms: 'Pixabay Content License', termsUrl: 'https://pixabay.com/service/license-summary/' },
  { name: 'Pexels', url: 'https://www.pexels.com/', terms: 'Pexels License', termsUrl: 'https://www.pexels.com/license/' },
];

const FONTS = [
  { name: 'Silkscreen', author: 'Jason Kottke', url: 'https://fonts.google.com/specimen/Silkscreen' },
  { name: 'VT323', author: 'Peter Hull', url: 'https://fonts.google.com/specimen/VT323' },
  { name: 'Pixelify Sans', author: 'Stefie Justprince', url: 'https://fonts.google.com/specimen/Pixelify+Sans' },
];

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

export default function CreditsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal titleId="credits-title" onClose={onClose}>
      <h2 id="credits-title">Credits</h2>

      <h3>Sounds</h3>
      <ul className="credit-list">
        {SOUNDS.map((s) => (
          <li key={s.id}>
            <span className="credit-use">{s.use}</span>
            <Ext href={`https://freesound.org/s/${s.id}/`}>{s.title}</Ext> by{' '}
            <Ext href={`https://freesound.org/people/${s.author}/`}>{s.author}</Ext> on Freesound,{' '}
            <Ext href={s.license === 'CC0' ? CC0 : CC_BY_4}>{s.license}</Ext>.{s.note && ` ${s.note}`}
          </li>
        ))}
      </ul>

      <h3>Photos</h3>
      <p className="muted">Each dish photo is credited to its photographer when the answer is revealed. They come from:</p>
      <ul className="credit-list">
        {PHOTO_SOURCES.map((p) => (
          <li key={p.name}>
            <span className="credit-use"><Ext href={p.url}>{p.name}</Ext></span>
            {p.termsUrl ? <Ext href={p.termsUrl}>{p.terms}</Ext> : p.terms}
          </li>
        ))}
      </ul>

      <h3>Fonts</h3>
      <ul className="credit-list">
        {FONTS.map((f) => (
          <li key={f.name}>
            <span className="credit-use"><Ext href={f.url}>{f.name}</Ext></span>
            by {f.author}, <Ext href={OFL}>SIL Open Font License</Ext>, via Google Fonts.
          </li>
        ))}
      </ul>

      <button className="primary" onClick={onClose} autoFocus>Back to the kitchen</button>
    </Modal>
  );
}
