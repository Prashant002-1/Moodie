import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Navigate, useOutletContext } from 'react-router-dom';
import HeroIdentity from '../components/landing/HeroIdentity';
import { LayoutOutletContext } from '../components/layout/Layout';
import { useUser } from '../contexts/UserContext';
import { CommunityEntry, discoveryService } from '../services/discoveryService';
import { EmotionScores } from '../types/emotion';
import { emotionColors, imageUrl } from '../utils/display';
import './HomeLanding.css';

const emotionKeys = Object.keys(emotionColors) as (keyof EmotionScores)[];

interface LandingMoment extends Partial<EmotionScores> {
  id: number | string;
  username: string;
  title: string;
  note: string;
  poster_path: string;
  feeling: string;
}

interface HeroBeat {
  meta: string;
  context: string;
  note: React.ReactNode;
  feeling: string;
  scores: Partial<EmotionScores>;
  film: {
    title: string;
    year: number;
    poster: string | null;
    backdrop: string | null;
  };
  reaction: {
    src: string;
    alt: string;
    caption: string;
  };
}

const pastLivesPoster = imageUrl('/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg', 'w500');
const whiplashPoster = imageUrl('/7fn624j5lj3xTme2SgiLCeuedmO.jpg', 'w500');
const screamPoster = imageUrl('/lr9ZIrmuwVmZhpZuTCW8D9g0ZJe.jpg', 'w500');

const cureFeelings: Partial<EmotionScores> = { neutral: 0.29, fearful: 0.76, disgusted: 0.19 };
const pastLivesFeelings: Partial<EmotionScores> = { neutral: 0.16, happy: 0.08, sad: 0.77, surprised: 0.06 };
const sharedWhiplashFeelings: Partial<EmotionScores> = { angry: 0.74, fearful: 0.18, disgusted: 0.12 };
const screamFeelings: Partial<EmotionScores> = { happy: 0.78, fearful: 0.27, surprised: 0.32 };

const heroBeats: HeroBeat[] = [
  {
    meta: '@hiro_s',
    context: 'Cure · public response',
    note: <>I watched it alone, expecting a clean scare. Instead the ordinary rooms made me tense, and I kept wondering how little distance there might be between a person and becoming unrecognizable.</>,
    feeling: 'Stillness · Tension · Unease',
    scores: cureFeelings,
    film: {
      title: 'Cure',
      year: 1997,
      poster: imageUrl('/xNVJr9q6AtSbjosS6Ed9YirOkSo.jpg', 'w500'),
      backdrop: imageUrl('/xxIRKSd9LmHojUD5grvMuGypwVC.jpg', 'w1280'),
    },
    reaction: {
      src: '/social/hiro-after-cure-natural.webp',
      alt: 'Hiro sitting quietly at his kitchen table after watching Cure',
      caption: 'Hiro, a few minutes later',
    },
  },
  {
    meta: 'From Hiro',
    context: 'Get Out · for you',
    note: <>Hiro found the same slow unease in <em>Get Out</em>. Not because it is another horror film—because every polite gesture seems to close one more exit.</>,
    feeling: 'Quiet dread · Friction · Recognition',
    scores: { angry: 0.39, fearful: 0.78, disgusted: 0.21 },
    film: {
      title: 'Get Out',
      year: 2017,
      poster: imageUrl('/tFXcEccSQMf3lfhfXKSU9iRBpa3.jpg', 'w500'),
      backdrop: imageUrl('/o8dPH0ZSIyyViP6rjRX1djwCUwI.jpg', 'w1280'),
    },
    reaction: {
      src: '/social/hiro-after-cure-natural.webp',
      alt: 'Hiro sitting quietly at his kitchen table',
      caption: 'A film carried by Hiro’s response',
    },
  },
  {
    meta: 'You + Ananya',
    context: 'Whiplash · felt familiar',
    note: <>Your responses both circle the same anger: how quickly approval can make damage look necessary. That shared feeling gives Ananya’s other films a reason to reach you.</>,
    feeling: 'Anger · Tension · Recognition',
    scores: sharedWhiplashFeelings,
    film: {
      title: 'Whiplash',
      year: 2014,
      poster: whiplashPoster,
      backdrop: imageUrl('/wbQa0EnWUyRzQ5d1pHLNRlmsCUP.jpg', 'w1280'),
    },
    reaction: {
      src: '/social/ananya-after-whiplash-natural.webp',
      alt: 'Ananya talking with friends after watching Whiplash',
      caption: 'Ananya kept the feeling, not a score',
    },
  },
  {
    meta: 'Your Joy list',
    context: 'Scream · from Ananya',
    note: <>We put this on for horror night and spent most of it laughing together. The tension made every release brighter. I saved that mix for anyone wanting the same kind of night.</>,
    feeling: 'Joy · Wonder · Tension',
    scores: screamFeelings,
    film: {
      title: 'Scream',
      year: 1996,
      poster: screamPoster,
      backdrop: imageUrl('/vh7np635kDIcfO6x2Y9ElgLJsuI.jpg', 'w1280'),
    },
    reaction: {
      src: '/social/ananya-after-whiplash-natural.webp',
      alt: 'Ananya laughing with friends after a movie night',
      caption: 'Horror to Ananya; joy to the people there',
    },
  },
  {
    meta: '@you',
    context: 'Past Lives · public',
    note: <>I expected regret. What stayed was the gentleness of letting grief sit beside a good life without asking that life to disappear. I left this here for someone living with that quieter ache.</>,
    feeling: 'Saved by @devon_m · the trail continues',
    scores: pastLivesFeelings,
    film: {
      title: 'Past Lives',
      year: 2023,
      poster: pastLivesPoster,
      backdrop: imageUrl('/7HR38hMBl23lf38MAN63y4pKsHz.jpg', 'w1280'),
    },
    reaction: {
      src: '/social/devon-after-past-lives.webp',
      alt: 'Devon smiling after watching Past Lives',
      caption: 'Devon found your response later',
    },
  },
];

const fallbackMoments: LandingMoment[] = [
  {
    id: 'fallback-moonlight',
    username: 'clara_valdez',
    title: 'Moonlight',
    poster_path: '/qLnfEmPrDjJfPyyddLJPkXmshkp.jpg',
    note: 'I watched this with my younger brother and kept thinking about all the tenderness we learn to hide before we have the language to ask for it.',
    feeling: 'Melancholy · Stillness',
    sad: 0.78,
    neutral: 0.18,
  },
  {
    id: 'fallback-matrix',
    username: 'marcus_k',
    title: 'The Matrix',
    poster_path: '/dXNAPwY7VrqMAo51EKhhCJfaGb5.jpg',
    note: 'The action was fun, but the feeling that stayed was stranger: how comfortable obedience can feel until somebody shows you the cage.',
    feeling: 'Wonder · Friction',
    surprised: 0.68,
    angry: 0.28,
  },
  {
    id: 'fallback-past-lives',
    username: 'devon_m',
    title: 'Past Lives',
    poster_path: '/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg',
    note: 'I expected regret. What caught me was the gentleness of letting grief sit beside a good life without asking that life to disappear.',
    feeling: 'Melancholy · Stillness',
    sad: 0.77,
    neutral: 0.16,
  },
  {
    id: 'fallback-spirited-away',
    username: 'maya_r',
    title: 'Spirited Away',
    poster_path: '/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg',
    note: 'Rewatching it with friends made me feel brave in a childlike way, as if kindness could still be enough to guide us through a world we did not understand.',
    feeling: 'Wonder · Joy',
    surprised: 0.71,
    happy: 0.34,
  },
  {
    id: 'fallback-parasite',
    username: 'rachel_g',
    title: 'Parasite',
    poster_path: '/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
    note: 'I laughed with everyone at first. By the end I felt ashamed of how quickly comfort can make another person’s suffering invisible.',
    feeling: 'Friction · Unease',
    angry: 0.68,
    disgusted: 0.42,
  },
];

const FeelingTrace: React.FC<{ label: string; scores?: Partial<EmotionScores> }> = ({ label, scores }) => (
  <div className="ef-feeling-trace" role="img" aria-label={label}>
    {emotionKeys.map(key => {
      const value = Number(scores?.[key]) || 0;
      return value > 0.01 ? <span key={key} style={{ backgroundColor: emotionColors[key], flexGrow: value }} /> : null;
    })}
  </div>
);

const Home: React.FC = () => {
  const { user } = useUser();
  const { openAuth, enterDemo, demoLoading } = useOutletContext<LayoutOutletContext>();
  const [entries, setEntries] = useState<CommunityEntry[]>([]);

  useEffect(() => {
    if (user) return;
    let active = true;
    discoveryService.feed(40)
      .then(result => { if (active) setEntries(result); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [user]);

  const communityMoments = useMemo(() => {
    const seen = new Set<string>();
    const live: LandingMoment[] = entries
      .filter(entry => entry.note && entry.poster_path)
      .map(entry => ({
        ...entry,
        poster_path: entry.poster_path as string,
        feeling: 'A feeling snapshot',
      }));

    return [...live, ...fallbackMoments]
      .filter(entry => {
        const key = entry.title.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 5);
  }, [entries]);

  if (user) return <Navigate replace to="/feed" />;

  return (
    <div className="ef-landing">
      <div aria-hidden="true" className="ef-landing__grain" />

      <section className="ef-hero" aria-labelledby="landing-title" data-nav-tone="light">
        <div aria-hidden="true" className="ef-hero__projector" />
        <div className="ef-hero__copy">
          <HeroIdentity
            demoLoading={demoLoading}
            onEnterDemo={() => void enterDemo()}
            onSignIn={openAuth}
          />
        </div>

        <div className="ef-hero__scene" aria-label="Film responses moving quietly from one person to another">
          <div aria-hidden="true" className="ef-hero-film-cycle">
            {heroBeats.map((beat, index) => (
              <div className={`ef-hero-film-cycle__frame ef-cycle-frame--${index + 1}`} key={beat.film.title}>
                {beat.film.backdrop && <img alt="" className="ef-hero__backdrop" src={beat.film.backdrop} />}
                <div className="ef-hero__wash" />
                {beat.film.poster && (
                  <figure className="ef-hero__poster">
                    <img alt="" src={beat.film.poster} />
                    <figcaption><strong>{beat.film.title}</strong><span>{beat.film.year}</span></figcaption>
                  </figure>
                )}
              </div>
            ))}
          </div>

          <article className="ef-hero-card">
            <p className="sr-only">
              Hiro records what Cure made him feel. His response carries Get Out to someone who recognizes that unease.
              A shared response to Whiplash makes Ananya&apos;s joyful experience of Scream relevant, even though it is a
              horror film. A new Past Lives response then reaches Devon and the trail continues.
            </p>
            <div aria-hidden="true" className="ef-hero-card__story">
              {heroBeats.map((beat, index) => (
                <div className={`ef-hero-card__beat ef-hero-card__beat--${index + 1}`} key={beat.context}>
                  <div className="ef-response-meta"><span>{beat.meta}</span><span>{beat.context}</span></div>
                  <blockquote>{beat.note}</blockquote>
                  <FeelingTrace label={beat.feeling} scores={beat.scores} />
                  <p>{beat.feeling}</p>
                </div>
              ))}
            </div>
          </article>

          <div aria-hidden="true" className="ef-hero-reaction-cycle">
            {heroBeats.map((beat, index) => (
              <div className={`ef-hero-reaction-cycle__frame ef-cycle-frame--${index + 1}`} key={`${beat.film.title}-reaction`}>
                <figure className="ef-hero__reaction">
                  <img alt="" src={beat.reaction.src} />
                  <figcaption>{beat.reaction.caption}</figcaption>
                </figure>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ef-capture" id="how-it-feels" aria-labelledby="capture-title" data-nav-tone="light">
        <div className="ef-capture__statement" data-reveal>
          <p className="ef-section-mark">After the credits</p>
          <h2 id="capture-title">Most places ask if the film was good. <em>They rarely ask what it did to you.</em></h2>
        </div>

        <div className="ef-capture__stage" data-reveal>
          {pastLivesPoster && (
            <figure className="ef-capture__poster">
              <img alt="Poster for Past Lives" loading="lazy" src={pastLivesPoster} />
              <figcaption>Past Lives · 2023</figcaption>
            </figure>
          )}
          <article className="ef-capture__response">
            <div className="ef-response-meta"><span>@devon_m</span><span>Public response</span></div>
            <blockquote>I expected regret. What caught me was the gentleness of letting grief sit beside a good life without asking that life to disappear.</blockquote>
            <FeelingTrace label="Melancholy, stillness, joy, and wonder" scores={pastLivesFeelings} />
            <p>Melancholy · Stillness · a little Joy</p>
          </article>
          <figure className="ef-capture__reaction">
            <img alt="Devon smiling after watching Past Lives" loading="lazy" src="/social/devon-after-past-lives.webp" />
            <figcaption>Attached because it felt worth keeping</figcaption>
          </figure>
        </div>

        <div className="ef-capture__prompt" data-reveal>
          <p>Write what stayed.</p>
          <p>Set the feeling mix yourself.</p>
          <p>Keep it private, or leave it where another person can find it.</p>
        </div>
      </section>

      <section className="ef-connection" id="people" aria-labelledby="connection-title" data-nav-tone="dark">
        <div className="ef-connection__heading" data-reveal>
          <p className="ef-section-mark">Discovery, with a memory</p>
          <h2 id="connection-title">A recommendation should be able to tell you who brought it here.</h2>
        </div>

        <div className="ef-connection__shared" data-reveal>
          <div className="ef-shared-film">
            {whiplashPoster && <img alt="Poster for Whiplash" loading="lazy" src={whiplashPoster} />}
            <div><span>Shared film</span><strong>Whiplash</strong></div>
          </div>
          <article className="ef-shared-response ef-shared-response--you">
            <span>You</span>
            <blockquote>I hated how quickly I started wanting the approval that was doing the damage.</blockquote>
          </article>
          <article className="ef-shared-response ef-shared-response--ananya">
            <span>@ananya_sen</span>
            <blockquote>I felt angry at the promise that suffering becomes worthwhile if the result impresses enough people.</blockquote>
          </article>
          <FeelingTrace label="Friction, tension, and unease shared across both responses" scores={sharedWhiplashFeelings} />
        </div>

        <div className="ef-connection__recommendation" data-reveal>
          <div className="ef-connection__want"><span>You asked for</span><strong>Joy</strong></div>
          {screamPoster && (
            <figure className="ef-connection__poster">
              <img alt="Poster for Scream" loading="lazy" src={screamPoster} />
              <figcaption>Scream · 1996</figcaption>
            </figure>
          )}
          <article className="ef-connection__response">
            <div className="ef-response-meta"><span>@ananya_sen</span><span>Scream · public</span></div>
            <blockquote>We put this on for a horror night and spent most of it laughing together. The tension made the release feel brighter. I saved that mix in case someone else wanted the same kind of night.</blockquote>
            <FeelingTrace label="Joy, wonder, and tension" scores={screamFeelings} />
            <p>Joy · Wonder · Tension</p>
          </article>
          <p className="ef-connection__reason">Scream reached you through Ananya&apos;s experience—not because horror was translated into a genre rule.</p>
        </div>
      </section>

      <section className="ef-community" id="community" aria-labelledby="community-title" data-nav-tone="light">
        <div className="ef-community__heading" data-reveal>
          <p className="ef-section-mark">The people stay visible</p>
          <h2 id="community-title">A room full of afterthoughts.</h2>
          <p>Follow the people whose responses keep opening films for you. Their words—not a popularity chart—give the feed its shape.</p>
        </div>

        <div className="ef-community__wall" aria-label="Recent public film responses">
          {communityMoments.map((entry, index) => {
            const poster = imageUrl(entry.poster_path, 'w342');
            return (
              <article className="ef-community-card" data-reveal key={entry.id} style={{ '--card-order': index } as React.CSSProperties}>
                {poster && <img alt={`Poster for ${entry.title}`} loading="lazy" src={poster} />}
                <div>
                  <div className="ef-response-meta"><span>@{entry.username}</span><span>{entry.title}</span></div>
                  <blockquote>{entry.note}</blockquote>
                  <FeelingTrace label={entry.feeling} scores={entry} />
                  <p>{entry.feeling}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="ef-diary" id="diary" aria-labelledby="diary-title" data-nav-tone="light">
        <div className="ef-diary__copy" data-reveal>
          <p className="ef-section-mark">Your diary, first</p>
          <h2 id="diary-title">The response belongs to you before it belongs to the network.</h2>
          <p>A private entry can shape what you find without becoming somebody else&apos;s story. A public one can carry a film forward. You choose each time.</p>
        </div>
        <div className="ef-diary__sheet" data-reveal>
          <div className="ef-diary__date"><span>Tonight</span><strong>What followed you home</strong></div>
          <article>
            <span className="ef-diary__visibility">Private</span>
            <h3>Cure</h3>
            <p>I am not ready to explain this one to anyone else. I only want to remember that the silence made my own apartment feel unfamiliar.</p>
          </article>
          <article>
            <span className="ef-diary__visibility ef-diary__visibility--public">Public</span>
            <h3>Past Lives</h3>
            <p>I want to leave this where somebody living with a gentler kind of grief might find it.</p>
          </article>
        </div>
      </section>

      <section className="ef-final" aria-labelledby="final-title" data-nav-tone="dark">
        <div className="ef-final__copy" data-reveal>
          <p className="ef-section-mark">Your turn</p>
          <h2 id="final-title">Bring the last film that followed you home.</h2>
          <p>Keep what it meant. Find the person who felt something familiar. Let the next film arrive with a human reason.</p>
        </div>
        <div className="ef-final__actions" data-reveal>
          <button className="ef-primary-action" disabled={demoLoading} onClick={() => void enterDemo()} type="button">
            {demoLoading ? 'Opening demo' : 'Enter demo'}<ArrowRight size={18} />
          </button>
          <button className="ef-text-action" onClick={openAuth} type="button">Sign in</button>
        </div>
      </section>
    </div>
  );
};

export default Home;
