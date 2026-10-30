import { useEffect } from 'react';

export default function HelpModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="help-title">How to play</h2>
        <p>Name the dish in <strong>10 guesses</strong>.</p>
        <ul>
          <li>You start with <strong>3 ingredients</strong>. Every wrong guess reveals another, from vague to giveaway.</li>
          <li>Every guess is compared with the answer, column by column:</li>
        </ul>
        <div className="help-tiles">
          <span className="cell tile exact">Pizza</span><span>Exact match</span>
          <span className="cell tile partial">Flatbread</span><span>Close: same group, region, or one step away</span>
          <span className="cell tile miss">Curry</span><span>Not it</span>
          <span className="cell tile partial">Mild <span className="arrow">▲</span></span><span>The answer is spicier</span>
        </div>
        <p>The <strong>closeness</strong> meter rolls everything into one number, so you can tell when you're in the right neighbourhood.</p>
        <p className="muted">Close is good enough: misspell it or describe it ("pineapple pizza") and we'll ask if you meant the closest dish.</p>
        <button className="primary" onClick={onClose} autoFocus>Let's eat</button>
      </div>
    </div>
  );
}
