import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DiscoveryPathCard } from '../components/recommendations/DiscoveryPathCard';
import { useDiary } from '../contexts/DiaryContext';
import { RecommendationResponse, recommendationService } from '../services/recommendationService';
import { usePageTitle } from '../hooks/usePageTitle';

/** Films that reached the viewer through a film they share with someone. */
const Recommendations = () => {
  const { currentSignal, revision } = useDiary();
  usePageTitle('Through films you share');
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    recommendationService.get(currentSignal || undefined)
      .then(recommendations => active && setData(recommendations))
      .catch(() => active && setError('Recommendations could not be loaded.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [currentSignal, revision, requestVersion]);

  const films = [...new Map([...(data?.forYou ?? []), ...(data?.adjacent ?? [])]
    .filter(movie => movie.recommended_by?.length)
    .map(movie => [movie.id, movie])).values()];

  return (
    <div className="page page--narrow">
      <header className="page__head"><h1>Through films you share</h1></header>
      {loading ? (
        <p className="status" role="status">Loading recommendations</p>
      ) : error ? (
        <p className="notice notice--error" role="alert">{error} <button className="link" onClick={() => setRequestVersion(version => version + 1)} type="button">Try again</button></p>
      ) : films.length ? (
        <div className="list list--flush">{films.map(movie => <DiscoveryPathCard headingLevel={2} key={movie.id} movie={movie} />)}</div>
      ) : data ? (
        <div className="empty"><p>No recommendations.</p><Link className="link" to="/log">Log a film</Link></div>
      ) : null}
    </div>
  );
};

export default Recommendations;
