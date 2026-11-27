import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useResource } from '../../hooks/useResource';
import { FilmPath, pathService } from '../../services/pathService';
import { Enjoyment } from '../../utils/paths';
import { Avatar } from '../common/Avatar';

const SAID: [Enjoyment | null, string][] = [['loved', 'loved it'], ['liked', 'liked it'], ['mixed', 'had mixed feelings'], ['not_for_me', 'did not take to it'], [null, 'wrote about it']];

/** On a film's page: what the people you have something in common with made of it. Nothing when none of them has said. */
export function FilmVoices({ movieId, version }: { movieId: number; version?: string | number }) {
  const { user } = useUser();
  const load = useCallback((signal: AbortSignal) => pathService.voices(movieId, signal), [movieId]);
  const found = useResource(`${user?.id}:voices:${movieId}`, load, version);
  const voices = found.data ?? [];
  if (!voices.length) return null;
  const name = (voice: FilmPath) => <Link className="who" key={voice.person.id} to={`#response-${voice.response.id}`}>{voice.person.username}</Link>;
  return <section aria-label="People you know" className="voices">
    <span className="path__faces">{voices.slice(0, 5).map(voice => <Avatar key={voice.person.id} size="sm" to={null} username={voice.person.username} />)}</span>
    <p>{SAID.map(([verdict, words]) => {
      const group = voices.filter(voice => voice.response.enjoyment === verdict);
      if (!group.length) return null;
      // Names are links to that person's response further down the page.
      const names = group.slice(0, 3).map(name);
      const rest = group.length - names.length;
      return <span key={words}>{names.map((node, index) => <span key={index}>{index > 0 && (index === names.length - 1 && !rest ? ' and ' : ', ')}{node}</span>)}{rest > 0 && ` and ${rest} more`} {words}. </span>;
    })}</p>
  </section>;
}
