import { Link } from 'react-router-dom';
import { CommunityPerson } from '../../services/discoveryService';

/** One person in a list: who they are, what you share, the last film they wrote about, and Follow. */
export function PersonRow({ person, disabled, onFollow }: { person: CommunityPerson; disabled: boolean; onFollow: (person: CommunityPerson) => void }) {
  return <li className="row">
    <span aria-hidden="true" className="avatar">{person.username.charAt(0)}</span>
    <div className="row__main">
      <p className="byline"><Link to={`/member/${person.username}`}>@{person.username}</Link>{person.follows_you && <span className="t-caption muted"> · Follows you</span>}</p>
      {person.bio && <p className="t-callout secondary">{person.bio}</p>}
      {person.shared_film_title && <p className="t-caption muted">You both responded to <span className="secondary">{person.shared_film_title}</span></p>}
      {person.latest_title && <p className="t-callout secondary clamp clamp--2">
        {person.latest_movie_id ? <Link className="film-inline" to={`/movie/${person.latest_movie_id}`}>{person.latest_title}</Link> : <span className="film-inline">{person.latest_title}</span>}
        {person.latest_note && <> {person.latest_note}</>}
      </p>}
    </div>
    <div className="row__aside">
      <button aria-label={`${person.following ? 'Unfollow' : 'Follow'} @${person.username}`} aria-pressed={person.following} className="btn btn--secondary btn--small" disabled={disabled} onClick={() => onFollow(person)} type="button">{person.following ? 'Following' : 'Follow'}</button>
    </div>
  </li>;
}
