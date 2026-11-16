import { Link } from 'react-router-dom';
import { CommunityPerson } from '../../services/discoveryService';
import { imageUrl } from '../../utils/display';
import { personHue } from '../../utils/person';
import { Avatar } from '../common/Avatar';

/** One person as a card: who they are in their colour, what you share, the last film they wrote about, and Follow. */
export function PersonRow({ person, disabled, onFollow }: { person: CommunityPerson; disabled: boolean; onFollow: (person: CommunityPerson) => void }) {
  const poster = imageUrl(person.latest_poster_path, 'w154');
  return <li className="person" data-hue={personHue(person.username)}>
    <div className="person__head">
      <Avatar size="lg" to={null} username={person.username} />
      <p className="person__name"><Link className="who" to={`/member/${person.username}`}>@{person.username}</Link>{person.follows_you && <span className="badge badge--hue">Follows you</span>}</p>
      <button aria-label={`${person.following ? 'Unfollow' : 'Follow'} @${person.username}`} aria-pressed={person.following} className="btn btn--secondary btn--small" disabled={disabled} onClick={() => onFollow(person)} type="button">{person.following ? 'Following' : 'Follow'}</button>
    </div>
    {person.bio && <p className="note clamp clamp--2">{person.bio}</p>}
    {person.shared_film_title && <p className="t-callout secondary">You both responded to <span className="film-inline">{person.shared_film_title}</span></p>}
    {person.latest_title && <div className="person__latest">
      <span className="poster poster--xs">{poster && <img alt={`Poster for ${person.latest_title}`} loading="lazy" src={poster} />}</span>
      <div className="row__main">
        <p className="tile__title">{person.latest_movie_id ? <Link to={`/movie/${person.latest_movie_id}`}>{person.latest_title}</Link> : person.latest_title}</p>
        {person.latest_note && <p className="note clamp clamp--2">{person.latest_note}</p>}
      </div>
    </div>}
  </li>;
}
