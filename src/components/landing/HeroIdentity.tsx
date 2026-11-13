import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const HeroIdentity: React.FC = () => (
  <div className="mf-hero-copy">
    <p className="mf-hero-copy__eyebrow">A social film journal and recommendation system</p>
    <div className="mf-hero-copy__statement">
      <h1 id="landing-title">No two people feel the same.</h1>
      <p className="mf-hero-copy__conclusion">
        Log how a film felt. Get recommendations from people who felt something similar.
      </p>
    </div>

    <div className="mf-hero-copy__actions">
      <Link className="mf-primary-action" to="/signup">Sign up<ArrowRight size={18} /></Link>
    </div>
  </div>
);

export default HeroIdentity;
