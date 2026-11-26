import { ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Ask, ConfirmContext, Question } from '../../hooks/useConfirm';

/** Moodie's own "are you sure": in the page, in its own words, in place of the browser's prompt. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<(Question & { resolve: (ok: boolean) => void }) | null>(null);
  const ask = useCallback<Ask>(question => new Promise(resolve => setOpen({ ...question, resolve })), []);
  const answer = (ok: boolean) => { open?.resolve(ok); setOpen(null); };
  const keep = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const title = useId(), body = useId();

  // Focus starts on the safe answer and goes back to where it was when the question closes.
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    keep.current?.focus();
    return () => before?.focus?.();
  }, [open]);

  const keys = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.stopPropagation(); answer(false); return; }
    if (event.key !== 'Tab') return;
    // Two buttons: Tab moves between them and never leaves the question.
    const buttons = [...(box.current?.querySelectorAll('button') ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    event.preventDefault();
    buttons[(at + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
  };

  return <ConfirmContext.Provider value={ask}>
    {children}
    {open && <div className="dialog" onClick={event => { if (event.target === event.currentTarget) answer(false); }} onKeyDown={keys}>
      <div aria-describedby={open.body ? body : undefined} aria-labelledby={title} aria-modal="true" className="dialog__box" ref={box} role="alertdialog">
        <h2 id={title}>{open.title}</h2>
        {open.body && <p className="secondary" id={body}>{open.body}</p>}
        <div className="actions">
          <button className="btn btn--primary" onClick={() => answer(true)} type="button">{open.action}</button>
          <button className="btn btn--secondary" onClick={() => answer(false)} ref={keep} type="button">Cancel</button>
        </div>
      </div>
    </div>}
  </ConfirmContext.Provider>;
}
