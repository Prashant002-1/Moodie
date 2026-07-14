import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Camera, MessageCircle, SlidersHorizontal, UsersRound } from 'lucide-react';
import { Navigate, useOutletContext } from 'react-router-dom';
import { LayoutOutletContext } from '../components/layout/Layout';
import { useUser } from '../contexts/UserContext';
import { catalogService } from '../services/catalogService';
import { CommunityEntry, CommunityPerson, discoveryService } from '../services/discoveryService';
import { EmotionScores } from '../types/emotion';
import { Movie } from '../types/movie';
import { dominantEmotion, emotionColors, emotionLabels, imageUrl, releaseYear } from '../utils/display';

const emotionKeys = Object.keys(emotionColors) as (keyof EmotionScores)[];

const FeelingTrace: React.FC<{ entry?: CommunityEntry; label: string }> = ({ entry, label }) => (
  <div className="feeling-trace" aria-label={label}>
    {emotionKeys.map(key => {
      const value = Number(entry?.[key]) || 0;
      return value > 0.01 ? <span key={key} style={{ backgroundColor: emotionColors[key], flexGrow: value }} /> : null;
    })}
  </div>
);

const Home: React.FC = () => {
  const { user } = useUser();
  const { openAuth, enterDemo, demoLoading } = useOutletContext<LayoutOutletContext>();
  const [films, setFilms] = useState<Movie[]>([]);
  const [entries, setEntries] = useState<CommunityEntry[]>([]);
  const [people, setPeople] = useState<CommunityPerson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) return;
    let active = true;
    Promise.allSettled([
      catalogService.trending(),
      discoveryService.feed(16),
      discoveryService.people(),
    ]).then(([filmResult, entryResult, peopleResult]) => {
      if (!active) return;
      if (filmResult.status === 'fulfilled') setFilms(filmResult.value.results.filter(film => film.poster_path));
      if (entryResult.status === 'fulfilled') setEntries(entryResult.value);
      if (peopleResult.status === 'fulfilled') setPeople(peopleResult.value);
      setLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  const featuredEntry = useMemo(
    () => entries.find(entry => entry.note && entry.poster_path && entry.backdrop_path) || entries.find(entry => entry.note) || entries[0],
    [entries],
  );
  const secondEntry = useMemo(
    () => entries.find(entry => entry.id !== featuredEntry?.id && entry.note && entry.poster_path) || entries[1],
    [entries, featuredEntry?.id],
  );
  const featuredFilm = films.find(film => film.backdrop_path && film.poster_path) || films[0];
  const featuredPerson = useMemo(() => {
    const matched = people.find(person => (
      person.id !== featuredEntry?.user_id
      && entries.some(entry => entry.user_id === person.id && entry.movie_id === featuredEntry?.movie_id)
      && entries.some(entry => entry.user_id === person.id && entry.movie_id !== featuredEntry?.movie_id)
    ));
    return matched || people.find(person => person.id !== featuredEntry?.user_id) || people[0];
  }, [entries, featuredEntry?.movie_id, featuredEntry?.user_id, people]);
  const heroEmotion = featuredEntry ? dominantEmotion(featuredEntry) : null;
  const secondEmotion = secondEntry ? dominantEmotion(secondEntry) : null;
  const sceneBackdrop = imageUrl(featuredEntry?.backdrop_path || featuredFilm?.backdrop_path, 'w1280');
  const scenePoster = imageUrl(featuredEntry?.poster_path || featuredFilm?.poster_path, 'w500');
  const secondPoster = imageUrl(secondEntry?.poster_path || films[2]?.poster_path, 'w500');
  const recommendationFilms = useMemo(() => {
    const fromPerson = entries
      .filter(entry => entry.user_id === featuredPerson?.id && entry.movie_id !== featuredEntry?.movie_id && entry.poster_path)
      .filter((entry, index, collection) => collection.findIndex(candidate => candidate.movie_id === entry.movie_id) === index)
      .slice(0, 3)
      .map(entry => ({ id: entry.movie_id, title: entry.title, poster_path: entry.poster_path }));
    if (fromPerson.length) return fromPerson;
    return films.slice(2, 5).map(film => ({ id: film.id, title: film.title, poster_path: film.poster_path }));
  }, [entries, featuredEntry?.movie_id, featuredPerson?.id, films]);

  if (user) return <Navigate replace to="/feed" />;

  return (
    <div className="landing-page landing-page--social">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero__copy" data-reveal>
          <p className="landing-kicker"><UsersRound size={17} />Social film discovery</p>
          <h1 id="landing-title">Films stay with people <strong>differently.</strong></h1>
          <p className="landing-hero__intro">Say how it felt. Find people who felt something similar. See what stayed with them next.</p>
          <div className="landing-actions">
            <button className="button button--primary" disabled={demoLoading} onClick={() => void enterDemo()} type="button">
              {demoLoading ? 'Opening demo' : 'Enter demo'}<ArrowRight size={18} />
            </button>
            <button className="landing-text-link" onClick={openAuth} type="button">Sign in</button>
          </div>
        </div>

        <div className="landing-hero__scene" aria-label="A public film response" data-reveal>
          {sceneBackdrop && <img alt="" aria-hidden="true" className="landing-scene__backdrop" data-parallax="0.04" src={sceneBackdrop} />}
          <div className="landing-scene__wash" />
          <div className="landing-scene__composition landing-scene__composition--post">
            <figure className="landing-expression-photo">
              <img alt="A person sharing how a film affected them" src={featuredEntry?.expression_image_path || '/social/ananya-after-whiplash.webp'} />
              <figcaption>Expression photo <span>optional</span></figcaption>
            </figure>
            {scenePoster && (
              <figure className="landing-scene__poster landing-scene__poster--small">
                <img alt={featuredEntry?.title ? `Poster for ${featuredEntry.title}` : 'Film poster'} src={scenePoster} />
                <figcaption><strong>{featuredEntry?.title || featuredFilm?.title}</strong><span>{releaseYear(featuredEntry?.release_date || featuredFilm?.release_date)}</span></figcaption>
              </figure>
            )}
            <article className={`landing-record landing-response${loading ? ' landing-record--loading' : ''}`}>
              <div className="landing-record__meta"><span>{featuredEntry ? `@${featuredEntry.username}` : '@ananya_sen'}</span><span>{featuredEntry?.title || 'One film'}</span></div>
              <blockquote>{featuredEntry?.note || 'I left feeling raw and strangely understood. I could not stop thinking about how badly I wanted them to be kind to each other.'}</blockquote>
              <FeelingTrace entry={featuredEntry} label="Feelings shared with this response" />
              <p className="landing-record__feeling">{heroEmotion ? emotionLabels[heroEmotion.emotion] : 'What they felt'}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-sequence ink-spill ink-spill--teal" id="how-it-works" aria-labelledby="sequence-title">
        <div className="landing-section-shell">
          <div className="landing-sequence__lead" data-reveal>
            <h2 id="sequence-title">What you felt is enough.</h2>
            <p>Start with what the film brought up in you. Let the response be personal, unfinished, even contradictory.</p>
          </div>
          <ol className="landing-path landing-path--three">
            <li data-reveal><span>01</span><MessageCircle aria-hidden="true" size={20} /><h3>Share what it meant to you.</h3></li>
            <li data-reveal><span>02</span><SlidersHorizontal aria-hidden="true" size={20} /><h3>Add the feelings that were there.</h3></li>
            <li data-reveal><span>03</span><UsersRound aria-hidden="true" size={21} /><h3>Meet people who felt something similar.</h3></li>
          </ol>
        </div>
      </section>

      <section className="landing-feelings ink-spill ink-spill--fig" id="feelings" aria-labelledby="feelings-title">
        <div className="landing-feelings__post" data-reveal>
          <figure className="landing-feelings__portrait">
            <img alt="A person sharing an optional expression photo after a film" loading="lazy" src={secondEntry?.expression_image_path || '/social/hiro-after-cure.webp'} />
          </figure>
          <article>
            <div className="landing-record__meta"><span>{secondEntry ? `@${secondEntry.username}` : '@hiro_s'}</span><span>{secondEntry?.title || 'After the film'}</span></div>
            <blockquote>{secondEntry?.note || 'I felt uneasy long after it ended. Not frightened exactly. More like I had seen something in myself that I wanted to look away from.'}</blockquote>
            <FeelingTrace entry={secondEntry} label="Feelings shared with this response" />
            <p>{secondEmotion ? emotionLabels[secondEmotion.emotion] : 'Their response'}</p>
          </article>
          {secondPoster && <img alt={secondEntry?.title ? `Poster for ${secondEntry.title}` : 'Film poster'} className="landing-feelings__poster" loading="lazy" src={secondPoster} />}
        </div>
        <div className="landing-feelings__copy" data-reveal>
          <h2 id="feelings-title">Your response is the point.</h2>
          <p>Write it. Set the feelings yourself. Add a photo if you want. Make it as brief, messy, or personal as the moment asks.</p>
          <div className="feeling-input-list" aria-label="Ways to share a film response">
            <span><MessageCircle size={18} />Your words</span>
            <span><SlidersHorizontal size={18} />Your feelings</span>
            <span><Camera size={18} />An optional photo</span>
          </div>
        </div>
      </section>

      <section className="landing-people ink-spill ink-spill--ink" id="people" aria-labelledby="people-title">
        <div className="landing-section-shell landing-people__inner">
          <div className="landing-people__copy" data-reveal>
            <h2 id="people-title">The social layer has a purpose.</h2>
            <p>Find people who respond to films like you do. Their next film can become yours.</p>
            <div className="landing-person">
              <span className="landing-person__avatar">{featuredPerson?.username.charAt(0).toUpperCase() || 'A'}</span>
              <div><strong>{featuredPerson ? `@${featuredPerson.username}` : '@ananya_sen'}</strong><span>You both felt something familiar.</span></div>
            </div>
          </div>
          <div className="landing-recommendation" aria-label="Films found through another person" data-reveal>
            <div className="landing-recommendation__posters">
              {recommendationFilms.map(film => {
                const poster = imageUrl(film.poster_path, 'w342');
                return poster ? <figure key={film.id}><img alt={`Poster for ${film.title}`} loading="lazy" src={poster} /><figcaption>{film.title}</figcaption></figure> : null;
              })}
            </div>
            <article className="landing-recommendation__reason"><span>From {featuredPerson ? `@${featuredPerson.username}` : '@ananya_sen'}</span><p>They felt something similar about {featuredEntry?.title || 'the same film'}. This is what moved them next.</p></article>
          </div>
        </div>
      </section>

      <section className="landing-final" aria-labelledby="landing-final-title" data-reveal>
        <h2 id="landing-final-title">Start with the last film that moved you.</h2>
        <div className="landing-actions">
          <button className="button button--primary" disabled={demoLoading} onClick={() => void enterDemo()} type="button">{demoLoading ? 'Opening demo' : 'Enter demo'}<ArrowRight size={18} /></button>
          <button className="landing-text-link" onClick={openAuth} type="button">Sign in</button>
        </div>
      </section>
    </div>
  );
};

export default Home;
