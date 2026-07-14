import React from 'react';
import { ArrowRight } from 'lucide-react';

interface HeroIdentityProps {
  demoLoading: boolean;
  onEnterDemo: () => void;
  onSignIn: () => void;
}

const HeroIdentity: React.FC<HeroIdentityProps> = ({ demoLoading, onEnterDemo, onSignIn }) => (
  <div className="ef-hero-copy">
    <p className="ef-hero-copy__eyebrow">Emotion-based film discovery</p>
    <div className="ef-hero-copy__statement">
      <h1 id="landing-title">
        <span className="ef-hero-copy__line">No two people</span>
        <span className="ef-hero-copy__line">leave <span className="ef-hero-copy__changing">the same film.</span></span>
      </h1>
      <p className="ef-hero-copy__conclusion">Find your next through people who felt something familiar.</p>
    </div>

    <div className="ef-hero-copy__actions">
      <button className="ef-primary-action" disabled={demoLoading} onClick={onEnterDemo} type="button">
        {demoLoading ? 'Opening demo' : 'Enter demo'}<ArrowRight size={18} />
      </button>
      <button className="ef-text-action" onClick={onSignIn} type="button">Sign in</button>
    </div>
  </div>
);

export default HeroIdentity;
