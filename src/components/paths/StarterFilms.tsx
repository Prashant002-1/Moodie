import { useCallback, useEffect, useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useDiary } from '../../contexts/DiaryContext';
import { useResource } from '../../hooks/useResource';
import { apiError } from '../../services/apiClient';
import { pathService, StarterFilm } from '../../services/pathService';
import type { DiaryVisibility } from '../../types/diary';
import type { EmotionScores } from '../../types/emotion';
import { Enjoyment, enjoymentLabels } from '../../types/suggestion';
import { imageUrl } from '../../utils/display';
import { noFeelings } from '../../utils/feelings';
import { FeelingChoices } from '../diary/FeelingChoices';

const VERDICTS: Enjoyment[] = ['loved', 'liked', 'mixed', 'not_for_me'];
const today = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); };

interface Answer { entryId: number; enjoyment: Enjoyment; feelings: EmotionScores }

/**
 * Films many people here have written about. Tap one you have seen and say how it was: that short answer is
 * what first connects a person to others. Each answer is saved as it is given.
 */
export function StarterFilms({ limit = 12, onAnswered }: { limit?: number; onAnswered?: (count: number) => void }) {
  const { user } = useUser();
  const { createEntry, updateEntry } = useDiary();
  const load = useCallback((signal: AbortSignal) => pathService.starter(limit, signal), [limit]);
  const found = useResource(`${user?.id}:starter:${limit}`, load);
  // The films stay as first shown: an answered poster keeps its place and shows the answer.
  const [films, setFilms] = useState<StarterFilm[] | null>(null);
  useEffect(() => { if (found.data) setFilms(previous => previous ?? found.data); }, [found.data]);
  const [open, setOpen] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [last, setLast] = useState<number | null>(null);
  const [visibility, setVisibility] = useState<DiaryVisibility>('public');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const count = Object.keys(answers).length;
  useEffect(() => { onAnswered?.(count); }, [count, onAnswered]);

  const answer = async (film: StarterFilm, enjoyment: Enjoyment) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const held = answers[film.id];
      const entry = held ? await updateEntry(held.entryId, { enjoyment, emotions: held.feelings })
        : await createEntry({ movieId: film.id, watchedOn: today(), note: '', visibility, emotions: noFeelings(), enjoyment });
      setAnswers(state => ({ ...state, [film.id]: { entryId: entry.id, enjoyment, feelings: held?.feelings ?? noFeelings() } }));
      setLast(film.id); setOpen(null);
    } catch (caught) { setError(apiError(caught, 'That answer could not be saved. Try again.')); }
    finally { setBusy(false); }
  };
  const feel = async (filmId: number, feelings: EmotionScores) => {
    const held = answers[filmId];
    if (!held || busy) return;
    setBusy(true); setError('');
    try {
      await updateEntry(held.entryId, { emotions: feelings, enjoyment: held.enjoyment });
      setAnswers(state => ({ ...state, [filmId]: { ...held, feelings } }));
    } catch (caught) { setError(apiError(caught, 'That could not be saved. Try again.')); }
    finally { setBusy(false); }
  };

  if (found.error) return <p className="status" role="alert">These films could not be loaded. <button className="link" onClick={found.refresh} type="button">Retry</button></p>;
  if (!films?.length) return null;
  const lastFilm = films.find(film => film.id === last);
  return <div className="starter">
    <ul className="starter__films">{films.map(film => {
      const given = answers[film.id];
      const poster = imageUrl(film.poster_path, 'w342');
      const choosing = open === film.id;
      return <li className="starter__film" data-answered={given ? '' : undefined} data-open={choosing ? '' : undefined} key={film.id}
        onKeyDown={event => { if (event.key === 'Escape' && choosing) { event.stopPropagation(); setOpen(null); } }}>
        <button aria-expanded={choosing} aria-label={given ? `${film.title}: ${enjoymentLabels[given.enjoyment]}. Change` : `I have seen ${film.title}`}
          className="starter__poster" disabled={busy} onClick={() => setOpen(choosing ? null : film.id)} type="button">
          <span className="poster">{poster && <img alt="" loading="lazy" src={poster} />}</span>
          {given && !choosing && <span aria-hidden="true" className="stamp">{enjoymentLabels[given.enjoyment]}</span>}
        </button>
        {choosing && <div aria-label={`How was ${film.title}?`} className="starter__choices" role="group">
          {VERDICTS.map(verdict => <button aria-pressed={given?.enjoyment === verdict} className="chip" disabled={busy} key={verdict} onClick={() => void answer(film, verdict)} type="button">{enjoymentLabels[verdict]}</button>)}
        </div>}
        <p className="tile__title">{film.title}</p>
      </li>;
    })}</ul>
    {error && <p className="notice notice--error" role="alert">{error}</p>}
    {lastFilm && answers[lastFilm.id] && <div className="starter__more">
      <p className="t-callout"><strong>{lastFilm.title}</strong> is in your diary.</p>
      <FeelingChoices disabled={busy} onChange={feelings => void feel(lastFilm.id, feelings)} value={answers[lastFilm.id].feelings} />
    </div>}
    <fieldset className="starter__who" disabled={busy}>
      <legend className="hint">Who can see these answers</legend>
      <div className="tabs" role="group">
        <button aria-pressed={visibility === 'public'} onClick={() => setVisibility('public')} type="button">Everyone</button>
        <button aria-pressed={visibility === 'private'} onClick={() => setVisibility('private')} type="button">Only me</button>
      </div>
    </fieldset>
  </div>;
}
