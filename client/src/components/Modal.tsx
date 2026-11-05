import { useEffect, type ReactNode } from 'react';

/** Dialog over a dimmed backdrop; closes on Escape, a click outside, or its × button. */
export default function Modal({ titleId, onClose, children }: { titleId: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        {children}
      </div>
    </div>
  );
}
