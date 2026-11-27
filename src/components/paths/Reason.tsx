import { Link } from 'react-router-dom';
import type { PathReason, Recipient } from '../../services/pathService';
import { feltWords, listed } from '../../utils/paths';

type Shared = Extract<PathReason, { kind: 'shared' }>;
const Film = ({ film }: { film: { id: number; title: string } }) => <Link className="film-inline" to={`/movie/${film.id}`}>{film.title}</Link>;

/** What two people have in common on one film, in a sentence. Feelings first; a shared verdict when there are none. */
export function SharedSentence({ shared }: { shared: Omit<Shared, 'kind'> }) {
  if (shared.feelings.length) return <>You both felt {listed(feltWords(shared.feelings))} after <Film film={shared.film} />.</>;
  if (shared.own_enjoyment && shared.own_enjoyment === shared.their_enjoyment && shared.own_enjoyment !== 'mixed') {
    if (shared.own_enjoyment === 'not_for_me') return <>Neither of you took to <Film film={shared.film} />.</>;
    return <>You both {shared.own_enjoyment === 'loved' ? 'loved' : 'liked'} <Film film={shared.film} />.</>;
  }
  return <>You both wrote about <Film film={shared.film} />.</>;
}

/** Why a film reaches you through this person. Following someone needs no sentence. */
export function PathWhy({ reason, person }: { reason: PathReason; person: string }) {
  if (reason.kind === 'following') return null;
  return <p className="path__why">{reason.kind === 'landed'
    ? <>You {reason.enjoyment === 'loved' ? 'loved' : 'liked'} <Film film={reason.film} />, which came from {person}.</>
    : <SharedSentence shared={reason} />}</p>;
}

/** Why this person might want a film from you. */
export function RecipientWhy({ reason }: { reason: NonNullable<Recipient['reason']> }) {
  return reason.kind === 'returned'
    ? <>{reason.enjoyment === 'loved' ? 'Loved' : 'Liked'} {reason.film.title} when you sent it.</>
    : reason.feelings.length ? <>You both felt {listed(feltWords(reason.feelings))} after {reason.film.title}.</>
    : <>You both wrote about {reason.film.title}.</>;
}
