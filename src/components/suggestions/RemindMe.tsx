import { useEffect, useId, useRef, useState } from 'react';
import { suggestionService } from '../../services/suggestionService';
import { apiError } from '../../services/apiClient';
import { FilmSuggestion, formatReminder, reminderChoices, reminderDue } from '../../types/suggestion';

// `datetime-local` reads and writes local wall-clock time without a zone.
const fieldValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

// The server keeps a reminder for at most a year.
const latest = () => { const date = new Date(); date.setFullYear(date.getFullYear() + 1); return date; };

/**
 * "Remind me" for a recommendation you received. Nothing is sent: the reminder
 * comes back at the top of Home and under Reminders once its time has passed.
 */
export function RemindMe({ item, onChange, label = 'Remind me', later = false, small = true }: {
  item: FilmSuggestion; onChange: (item: FilmSuggestion) => void;
  /** The words on the button while no reminder is shown. */
  label?: string;
  /** Only the button: for a reminder that is already shown as due beside it. */
  later?: boolean;
  /** The button's size: small inside a note, full beside a page's other actions. */
  small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const set = item.remind_at != null;
  const showState = set && !later;

  const close = (refocus = false) => { setOpen(false); setPicking(false); if (refocus) trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('button, input')?.focus();
    const outside = (event: PointerEvent | MouseEvent) => { if (!root.current?.contains(event.target as Node)) { setOpen(false); setPicking(false); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('mousedown', outside);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('mousedown', outside); };
  }, [open]);

  const save = async (action: { action: 'remind'; remindAt: string } | { action: 'clear_reminder' }) => {
    if (busy) return;
    setBusy(true); setError('');
    try { onChange(await suggestionService.update(item.id, action)); close(true); }
    catch (error) { setError(apiError(error, 'The reminder could not be saved. Try again.')); }
    finally { setBusy(false); }
  };
  const pick = () => {
    const date = new Date(custom);
    if (!custom || Number.isNaN(date.getTime())) return setError('Choose a date and time.');
    if (date <= new Date()) return setError('Choose a time in the future.');
    if (date > latest()) return setError('Choose a time within the next year.');
    void save({ action: 'remind', remindAt: date.toISOString() });
  };
  const keys = (event: React.KeyboardEvent) => {
    if (!open) return;
    if (event.key === 'Escape') { event.stopPropagation(); close(true); return; }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index < 0 || (document.activeElement as HTMLElement).tagName === 'INPUT') return;
    event.preventDefault();
    items[(index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
  };

  const now = new Date();
  return <div className="menu remind" onKeyDown={keys} ref={root}>
    {showState && <span className="remind__state">
      {reminderDue(item) && <span className="badge badge--accent">Due</span>}
      <span>Reminder <time dateTime={item.remind_at!}>{formatReminder(item.remind_at!)}</time></span>
    </span>}
    <button aria-controls={open ? id : undefined} aria-expanded={open} className={showState ? 'link' : `btn btn--secondary${small ? ' btn--small' : ''}`} disabled={busy && !open}
      onClick={() => (open ? close() : setOpen(true))} ref={trigger} type="button">{showState ? 'Change' : label}<span className="sr-only">{showState ? ` reminder about ${item.title}` : later ? `, remind me about ${item.title}` : ` about ${item.title}`}</span></button>
    {showState && <button className="link" disabled={busy} onClick={() => void save({ action: 'clear_reminder' })} type="button">Clear<span className="sr-only"> reminder about {item.title}</span></button>}
    {open && <div aria-label={`Remind me about ${item.title}`} className="menu__list" id={id} ref={panel} role="group">
      {!picking ? <>
        {reminderChoices(now).map(choice => <button disabled={busy} key={choice.label} onClick={() => void save({ action: 'remind', remindAt: choice.at.toISOString() })} type="button">
          <span>{choice.label}</span><span className="remind__when">{formatReminder(choice.at)}</span>
        </button>)}
        <button disabled={busy} onClick={() => { setPicking(true); setCustom(value => value || fieldValue(reminderChoices(now)[0].at)); setError(''); }} type="button">Pick a time</button>
        {set && later && <button disabled={busy} onClick={() => void save({ action: 'clear_reminder' })} type="button">Clear reminder</button>}
      </> : <form className="remind__pick" noValidate onSubmit={event => { event.preventDefault(); event.stopPropagation(); pick(); }}>
        <div className="field"><label htmlFor={`${id}-at`}>Pick a time</label>
          <input autoFocus className="input" id={`${id}-at`} max={fieldValue(latest())} min={fieldValue(now)} onChange={event => { setCustom(event.target.value); setError(''); }} required type="datetime-local" value={custom} /></div>
        <div className="actions"><button className="btn btn--secondary btn--small" disabled={busy}>Set reminder</button><button className="btn btn--quiet btn--small" onClick={() => { setPicking(false); setError(''); }} type="button">Back</button></div>
      </form>}
      {error && <p className="error t-caption" role="alert">{error}</p>}
    </div>}
    {error && !open && <span className="error t-caption" role="alert">{error}</span>}
  </div>;
}
