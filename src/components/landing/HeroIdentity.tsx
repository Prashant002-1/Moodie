import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';

interface HeroIdentityProps {
  demoLoading: boolean;
  onEnterDemo: () => void;
  onSignIn: () => void;
}

const LAST_STORY_PHASE = 4;
const STORY_PHASE_MS = 4000;

const storyLabels = [
  'Maya records what stayed with her.',
  'Her public response becomes a path.',
  'Two shared films reveal something familiar.',
  'You choose Joy. Her response reaches you.',
  'Your response makes the path wider.',
];

const prefersReducedMotion = () => (
  typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

const FeelingLine: React.FC<{ color: string; label: string; width: string }> = ({ color, label, width }) => (
  <div className="hero-story__feeling">
    <span>{label}</span>
    <span className="hero-story__feeling-track"><i style={{ backgroundColor: color, width }} /></span>
  </div>
);

const HeroIdentity: React.FC<HeroIdentityProps> = ({ demoLoading, onEnterDemo, onSignIn }) => {
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const [phase, setPhase] = useState(() => prefersReducedMotion() ? LAST_STORY_PHASE : 0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
      if (event.matches) setPhase(LAST_STORY_PHASE);
    };

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (reducedMotion || paused || phase >= LAST_STORY_PHASE) return undefined;
    const timeout = window.setTimeout(() => setPhase(current => current + 1), STORY_PHASE_MS);
    return () => window.clearTimeout(timeout);
  }, [paused, phase, reducedMotion]);

  const storyComplete = phase === LAST_STORY_PHASE;
  const toggleStory = () => {
    if (storyComplete) {
      setPhase(0);
      setPaused(false);
      return;
    }
    setPaused(current => !current);
  };

  return (
    <div className="hero-identity">
      <div className="hero-identity__copy">
        <h1 id="landing-title">No two people leave the same film.</h1>
        <p className="hero-identity__conclusion">Find your next through people who felt something familiar.</p>
        <div className="landing-actions hero-identity__actions">
          <button className="button button--primary" disabled={demoLoading} onClick={onEnterDemo} type="button">
            {demoLoading ? 'Opening demo' : 'Enter demo'}<ArrowRight size={18} />
          </button>
          <button className="landing-text-link" onClick={onSignIn} type="button">Sign in</button>
        </div>
      </div>

      <section className="hero-story" aria-label="How one response becomes a recommendation">
        <p className="sr-only">
          Maya records that the horror film Scream made her feel joy. Because you and Maya responded similarly to
          Parasite and Whiplash, choosing Joy reveals her public response as a recommendation. After you respond to
          Scream, your response can guide another person toward it.
        </p>

        <header className="hero-story__header">
          <div>
            <span className="hero-story__eyebrow">One response, passed person to person</span>
            <p>{reducedMotion ? 'The complete path' : storyLabels[phase]}</p>
          </div>
          {!reducedMotion && (
            <button className="hero-story__control" onClick={toggleStory} type="button">
              {storyComplete ? 'Replay' : paused ? 'Continue' : 'Pause'}
            </button>
          )}
        </header>

        <div className="hero-story__canvas" data-phase={phase} aria-hidden="true">
          <div className="hero-story__people">
            <div className="hero-story__person hero-story__person--maya"><span>M</span><p>Maya</p></div>
            <div className={`hero-story__connection${phase >= 2 ? ' is-visible' : ''}`}><i /></div>
            <div className={`hero-story__person hero-story__person--you${phase >= 2 ? ' is-visible' : ''}`}><span>Y</span><p>You</p></div>
          </div>

          <div className={`hero-story__shared${phase >= 2 ? ' is-visible' : ''}`}>
            <span>Felt something familiar on two films</span>
            <div><strong>Parasite · Unease</strong><strong>Whiplash · Friction</strong></div>
          </div>

          <aside className={`hero-story__tray${phase >= 3 ? ' is-visible' : ''}`}>
            <div className="hero-story__tray-header"><span>Discover</span><strong>You chose Joy</strong></div>
            <div className="hero-story__reason">
              <span>From people who felt something similar</span>
              <p>Maya felt something familiar about <em>Parasite</em>. This stayed with her too.</p>
            </div>
          </aside>

          <article className={`hero-story__response${phase >= 3 ? ' is-passed' : ''}`}>
            <header>
              <span>Maya · public response</span>
              <span className={`hero-story__save-state${phase >= 1 ? ' is-saved' : ''}`}>
                <span>Adding response</span>
                <span>Response saved</span>
              </span>
            </header>

            <div className="hero-story__response-body">
              <div className="hero-story__film" aria-label="Scream, 1996">
                <span>Scream</span><small>1996</small>
              </div>
              <div className="hero-story__response-copy">
                <p>What did it mean to you?</p>
                <blockquote>I left smiling. The fear felt playful, like being in on the joke.</blockquote>
                <div className="hero-story__feelings">
                  <FeelingLine color="var(--color-oxide)" label="Joy" width="82%" />
                  <FeelingLine color="var(--color-fig)" label="Tension" width="34%" />
                  <FeelingLine color="var(--color-teal)" label="Wonder" width="18%" />
                </div>
              </div>
            </div>

            <footer>
              <span><small>Catalog</small>Horror</span>
              <span><small>Maya felt</small>Joy</span>
            </footer>
          </article>

          <article className={`hero-story__ripple${phase >= 4 ? ' is-visible' : ''}`}>
            <div>
              <span>You · after Scream</span>
              <blockquote>I wanted joy. It was sharp, funny, and exactly right.</blockquote>
            </div>
            <p><strong>Joy · Tension</strong>Your response can now become someone else&apos;s way in.</p>
          </article>
        </div>
      </section>
    </div>
  );
};

export default HeroIdentity;
