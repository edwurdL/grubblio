import Modal from './Modal';

export default function HelpModal({ onClose, onCredits }: { onClose: () => void; onCredits: () => void }) {
  return (
    <Modal titleId="help-title" onClose={onClose}>
      <h2 id="help-title">How to play</h2>
      <p>Name the dish before you run out of <strong>9 plates</strong>. Every miss breaks one.</p>
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
      <div className="modal-actions">
        <button className="primary" onClick={onClose} autoFocus>Let's eat</button>
        <button className="ghost" onClick={onCredits}>Credits</button>
      </div>
    </Modal>
  );
}
