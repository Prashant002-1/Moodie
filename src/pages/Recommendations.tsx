import React, { useEffect, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { EmotionCapture } from '../components/EmotionCapture';
import FilmPoster from '../components/features/movie/FilmPoster';
import FilmRail from '../components/features/movie/FilmRail';
import { useDiary } from '../contexts/DiaryContext';
import { catalogService } from '../services/catalogService';
import { RecommendationResponse, recommendationService } from '../services/recommendationService';
import { EmotionScores } from '../types/emotion';
import { Movie } from '../types/movie';

const Recommendations: React.FC = () => {
  const { currentSignal, setCurrentSignal } = useDiary();
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [browseFilms, setBrowseFilms] = useState<Movie[]>([]);
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [signalOpen, setSignalOpen] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      recommendationService.get(currentSignal || undefined),
      catalogService.trending().catch(() => ({ results: [] } as { results: Movie[] })),
    ])
      .then(([recommendations, browse]) => {
        if (!active) return;
        setData(recommendations);
        setBrowseFilms(browse.results.filter(movie => movie.poster_path).slice(0, 18));
      })
      .catch(() => active && setError('Discover could not be loaded.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [currentSignal, requestVersion]);

  const submitSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const next = query.trim();
    if (!next) return;
    setSearchTerm(next);
    setSearching(true);
    setError('');
    try {
      const response = await catalogService.search(next);
      setSearchResults(response.results.filter(movie => movie.poster_path));
    } catch {
      setError('Film search could not be loaded.');
    } finally {
      setSearching(false);
    }
  };

  const acceptSignal = (signal: EmotionScores) => {
    setCurrentSignal(signal);
    setSignalOpen(false);
  };

  return (
    <div className="page-shell recommendation-page discover-page">
      <header className="discover-header">
        <h1 className="page-title">Discover</h1>
        <button className="button button--secondary" onClick={() => setSignalOpen(open => !open)} type="button">
          {signalOpen ? <X size={18} /> : <SlidersHorizontal size={18} />}{signalOpen ? 'Close' : currentSignal ? 'Change feeling' : 'Choose a feeling'}
        </button>
      </header>

      {signalOpen && (
        <section className="signal-panel" aria-label="Choose a feeling">
          <div className="signal-panel__intro"><h2>What do you want to feel?</h2></div>
          <EmotionCapture onCancel={() => setSignalOpen(false)} onEmotionsDetected={acceptSignal} />
        </section>
      )}

      {loading ? (
        <div className="loading-state"><div className="loading-spinner" /><span>Finding films</span></div>
      ) : error && !data ? (
        <div className="error-state"><p>{error}</p><button className="button button--secondary" onClick={() => setRequestVersion(version => version + 1)} type="button">Try again</button></div>
      ) : data ? (
        <div className="recommendation-lanes recommendation-lanes--people" data-reveal>
          <FilmRail movies={data.forYou} title="From people who felt something similar" />
          {data.adjacent.length > 0 && <FilmRail movies={data.adjacent} title="More from those people" />}
          {data.community.length > 0 && <FilmRail movies={data.community} title="Around the community" />}
        </div>
      ) : null}

      <section className="browse-section" aria-labelledby="browse-title" data-reveal>
        <div className="browse-section__heading"><h2 id="browse-title">Browse films</h2></div>
        <form className="search-bar" onSubmit={submitSearch} role="search">
          <Search aria-hidden="true" size={20} />
          <input aria-label="Search films" className="input" onChange={event => setQuery(event.target.value)} placeholder="Search by title" type="search" value={query} />
          <button className="button button--quiet" disabled={!query.trim() || searching} type="submit">{searching ? 'Searching' : 'Search'}</button>
        </form>
        {error && data && <p className="error-text" role="alert">{error}</p>}
        {searchTerm ? (
          <>
            <button className="text-link search-reset" onClick={() => { setSearchTerm(''); setQuery(''); setSearchResults([]); }} type="button">Clear search</button>
            {searching ? <div className="loading-state"><div className="loading-spinner" /></div> : searchResults.length ? <div className="poster-grid">{searchResults.map(movie => <FilmPoster key={movie.id} movie={movie} />)}</div> : <div className="empty-state"><h3>No films found</h3></div>}
          </>
        ) : browseFilms.length ? <FilmRail movies={browseFilms} title="" /> : null}
      </section>
    </div>
  );
};

export default Recommendations;
