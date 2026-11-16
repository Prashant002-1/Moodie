import { Link, Navigate } from 'react-router-dom';
import { Avatar } from '../components/common/Avatar';
import { Feelings } from '../components/response/Feelings';
import { useUser } from '../contexts/UserContext';
import { imageUrl } from '../utils/display';
import { feelingWords, feelingsFromOrder } from '../utils/feelings';
import { personHue } from '../utils/person';

// Sample people and real films, so the front page shows Moodie's own objects
// before anyone has an account. Nothing here is live content.
const art = '/7HR38hMBl23lf38MAN63y4pKsHz.jpg'; // Past Lives, the film in the note below
const note = {
  from: 'hiro', title: 'Past Lives', year: '2023', poster: '/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg',
  reason: 'For that conversation we had about the lives we might have lived. The last scene stayed with me.',
  reply: 'I thought about it the whole walk home. Thank you for knowing.',
  felt: feelingsFromOrder(['sad', 'neutral']),
};
const wall = [
  { who: 'ananya', title: 'Whiplash', poster: '/7fn624j5lj3xTme2SgiLCeuedmO.jpg', felt: feelingsFromOrder(['fearful', 'happy']) },
  { who: 'elena', title: 'Perfect Days', poster: '/tvUHVSTJV9ITON3oyHaWp7oaAc8.jpg', felt: feelingsFromOrder(['neutral', 'happy']) },
  { who: 'noor', title: 'Scream', poster: '/lr9ZIrmuwVmZhpZuTCW8D9g0ZJe.jpg', felt: feelingsFromOrder(['happy', 'surprised']) },
  { who: 'sam', title: 'BlackBerry', poster: '/neV35lK7em4rIY9QIoH1cruErPA.jpg', felt: feelingsFromOrder(['surprised', 'angry']) },
  { who: 'priya', title: 'The Whale', poster: '/jQ0gylJMxWSL490sy0RrPj1Lj7e.jpg', felt: feelingsFromOrder(['sad', 'neutral']) },
];

/** The signed-out front page: what Moodie is, shown with its own objects. */
export default function Home() {
  const { user, loading } = useUser();
  if (loading) return null;
  if (user) return <Navigate replace to="/feed" />;
  return <>
    <section className="band band--art">
      <img alt="" className="band__art" src={imageUrl(art, 'w1280')!} />
      <div className="box"><div className="frontpage__hero">
        <h1 className="t-display">Films and shows, found through people.</h1>
        <p>A friend recommends a film and says why. You watch it, and tell them how it landed.</p>
        <div className="actions"><Link className="btn btn--primary" to="/signup">Sign up</Link><Link className="btn btn--secondary" to="/signin">Sign in</Link></div>
      </div></div>
    </section>
    <div className="page stack stack--loose">
      <div className="frontpage__show">
        <section aria-label="Example: a recommendation from a friend, and a reply">
          <header className="section__head"><h2>Recommended to you</h2><span className="label">Example</span></header>
          <article className="rec" data-hue={personHue(note.from)}>
            <span className="poster poster--lg"><img alt={`Poster for ${note.title}`} src={imageUrl(note.poster, 'w342')!} /></span>
            <div className="rec__main">
              <p className="rec__from"><Avatar size="sm" to={null} username={note.from} /><span><span className="who">{note.from}</span> thought of you</span></p>
              <h3 className="rec__title">{note.title}<span className="year">{note.year}</span></h3>
              <blockquote className="quote">{note.reason}</blockquote>
              <p className="rec__state">Watched · replied</p>
            </div>
          </article>
          <div className="frontpage__reply" data-hue={personHue('you')}>
            <Avatar to={null} username="you" />
            <div>
              <p className="byline"><strong>You</strong> told {note.from} how it landed</p>
              <Feelings entry={note.felt} />
              <blockquote className="quote quote--small">{note.reply}</blockquote>
            </div>
          </div>
        </section>
        <ul className="frontpage__points">
          <li><strong>Who recommended it, and why,</strong> stays with the film.</li>
          <li>You reply with how it landed, <strong>in words, not stars.</strong></li>
          <li><strong>AI is your choice.</strong> Moodie works with it or without it.</li>
        </ul>
      </div>
      <section aria-label="Example: new responses from friends">
        <header className="section__head"><h2>New from friends</h2><span className="label">Example</span></header>
        <div className="frontpage__wall">{wall.map(item => <article className="tile" data-hue={personHue(item.who)} key={item.title}>
          <span className="tile__art">
            <span className="poster"><img alt={`Poster for ${item.title}`} loading="lazy" src={imageUrl(item.poster, 'w342')!} /></span>
            <Avatar className="tile__who" size="sm" to={null} username={item.who} />
          </span>
          <p className="tile__name who">{item.who}</p>
          <p className="tile__sub">{feelingWords(item.felt).join(' · ')}</p>
        </article>)}</div>
      </section>
    </div>
  </>;
}
