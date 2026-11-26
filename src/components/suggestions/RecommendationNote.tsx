import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FilmSuggestion, formatReminder, progressLabels, progressSteps, reminderDue, suggestionContext, suggestionPerson, suggestionStatus } from '../../types/suggestion';
import { imageUrl, releaseYear } from '../../utils/display';
import { personHue } from '../../utils/person';
import { Avatar } from '../common/Avatar';
import { RemindMe } from './RemindMe';

/**
 * A recommendation as a note from a person: who it is from, the film, and
 * what they said, in their colour. This is Moodie's signature object.
 *
 * Full size it carries, for one you received and have not watched, the next steps. `compact` is the same note set small.
 */
export function RecommendationNote({ item: given, viewerId, compact = false, headingLevel = 3, onChange, tracker = false, later = false,
  primary = true, page = false, preview = false, hideFilm = false, children }: {
  item: FilmSuggestion; viewerId: number; compact?: boolean; headingLevel?: 1 | 2 | 3;
  /** Told when a reminder on this note is set, changed or cleared. */
  onChange?: (item: FilmSuggestion) => void;
  /** For a recommendation you sent: show what happened to it. */
  tracker?: boolean;
  /** For a reminder that has come due: "I watched it" and "Later" on the note, at any size. */
  later?: boolean;
  /** Whether "I watched it" is the one primary action where this note is shown. */
  primary?: boolean;
  /** The note at the top of its own page: it links to the film and the page carries the next steps. */
  page?: boolean;
  /** The note while it is being written: nothing in it can be opened. */
  preview?: boolean;
  /** On the film's own page, where the poster and title are already shown. */
  hideFilm?: boolean;
  children?: ReactNode;
}) {
  // A reminder set from the note shows at once, whether or not the screen keeps its own copy.
  const [item, setItem] = useState(given);
  useEffect(() => setItem(given), [given]);
  const change = (next: FilmSuggestion) => { setItem(next); onChange?.(next); };

  const person = suggestionPerson(item, viewerId);
  const received = item.recipient_id === viewerId;
  const who = preview ? <strong className="who">{person}</strong> : <Link className="who" to={`/member/${encodeURIComponent(person)}`}>{person}</Link>;
  const poster = imageUrl(item.poster_path, compact ? 'w154' : 'w342');
  const Title = headingLevel === 1 ? 'h1' : headingLevel === 2 ? 'h2' : 'h3';
  const open = `/suggestions/${item.id}`, film = `/movie/${item.movie_id}`, log = `/log?movieId=${item.movie_id}&suggestionId=${item.id}`;
  const to = page ? film : open;
  const waiting = received && !item.archived && (item.status === 'suggested' || item.status === 'saved');
  const showTracker = tracker && !received;
  // "Recommended to you" and "Sent" only repeat the first line. On its own page the buttons and sections under the note say the rest.
  const state = item.archived ? 'Archived' : showTracker || item.status === 'suggested' || item.status === 'sent' || (page && item.status !== 'watched') ? null : suggestionStatus[item.status];
  // The first step has always happened. An API from before `progress` existed says nothing more.
  const reached = Math.max(0, progressSteps.indexOf(item.progress));
  const context = suggestionContext(item);
  const posterSize = `poster ${compact ? 'poster--sm' : 'poster--lg'}`;
  const actions = !preview && !page && waiting && (later || !compact);
  // A full-size note shows its reminder in the control beside its actions. Elsewhere it is one line.
  const reminder = received && item.remind_at && !actions && !preview && !page;

  return <article className={`rec${compact ? ' rec--compact' : ''}${hideFilm ? ' rec--words' : ''}${preview ? ' rec--preview' : ''}${page ? ' rec--page' : ''}`} data-hue={personHue(person)}>
    {!hideFilm && (preview
      ? <span className={posterSize}>{poster && <img alt={`Poster for ${item.title}`} src={poster} />}</span>
      : <Link className={posterSize} tabIndex={-1} to={to}>{poster && <img alt={`Poster for ${item.title}`} loading="lazy" src={poster} />}</Link>)}
    <div className="rec__main">
      <p className="rec__from">
        <Avatar size="sm" to={null} username={person} />
        <span>{received
          ? item.origin === 'sent' ? <>{who} thought of you</> : <>Found through {who}</>
          : item.origin === 'sent' ? <>You thought of {who}</> : <>{who} found this through you</>}</span>
      </p>
      {!hideFilm && <Title className="rec__title">{preview ? item.title : <Link to={to}>{item.title}</Link>}{item.release_date && <> <span className="year">{releaseYear(item.release_date)}</span></>}</Title>}
      {(context || !preview) && <blockquote className="quote">{context}</blockquote>}
      {showTracker && <ol aria-label={`${item.title}: ${progressLabels[progressSteps[reached]].toLowerCase()}`} className="tracker">
        {progressSteps.map((step, index) => <li aria-current={index === reached ? 'step' : undefined} key={step}>
          <span className={`badge${index <= reached ? ' badge--hue' : ''}`}>{index === 0 && item.origin === 'discovered' ? 'Found' : progressLabels[step]}{index > reached && <span className="sr-only"> (not yet)</span>}</span>
        </li>)}
      </ol>}
      {(state || reminder || (hideFilm && !actions)) && <p className="rec__foot">
        {state && <span className="rec__state">{state}</span>}
        {reminder && (reminderDue(item)
          ? <span className="badge badge--accent">Due<span className="sr-only">: reminder from {formatReminder(item.remind_at!, false)}</span></span>
          : <span className="rec__state">Reminder <time dateTime={item.remind_at!}>{formatReminder(item.remind_at!, false)}</time></span>)}
        {hideFilm && !actions && <Link className="link t-caption" to={open}>Open</Link>}
      </p>}
      {actions && <div className="actions">
        {later && reminderDue(item) && <span className="badge badge--accent">Due</span>}
        <Link className={`btn ${primary ? 'btn--primary' : 'btn--secondary'} btn--small`} to={log}>I watched it<span className="sr-only">: {item.title}</span></Link>
        <RemindMe item={item} label={later ? 'Later' : undefined} later={later} onChange={change} />
        {!later && <Link className="btn btn--quiet btn--small" to={open}>Open<span className="sr-only"> {item.title}</span></Link>}
      </div>}
      {!actions && !preview && !page && !compact && received && !item.archived && item.status === 'watched'
        && <div className="actions"><Link className="btn btn--secondary btn--small" to={open}>Reply<span className="sr-only"> to {item.sender_username} about {item.title}</span></Link></div>}
      {children}
    </div>
  </article>;
}
