'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}): ReactNode {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previouslyFocused?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className={wide ? 'modal wide' : 'modal'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog" autoFocus>
            <X size={19} />
          </button>
        </header>
        <div className="modal-content">{children}</div>
      </section>
    </div>
  );
}
