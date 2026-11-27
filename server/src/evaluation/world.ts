/**
 * A made-up community with a known truth, for testing discovery.
 *
 * Real members are the only real test. Until there are some, this gives the one
 * thing live data never can: for every person and every film, whether that
 * person would in fact have loved it. A strategy is then judged on what it
 * offers, not on what people happened to watch.
 *
 * The world is deliberately adjustable in the places Moodie cannot know yet:
 * how much the words people choose say about whether they enjoyed a film, and
 * how alike the people someone follows are to them. A finding only counts when
 * it holds across those settings.
 *
 * Nothing here calls the engine. Tastes, feelings, follows and viewing are
 * generated independently of any ranking rule.
 */
import { Landing, Seen, Verdict } from '../discovery/engine';

export const WORDS = ['still', 'joy', 'melancholy', 'friction', 'tension', 'unease', 'wonder'];
// How each word leans when a person is enjoying a film. Only the simulator knows this; the engine never does.
const LEAN = [-0.8, 1, 0, -0.6, 0.2, -0.4, 0.8];

export interface WorldOptions {
  seed: number;
  people: number;
  films: number;
  days: number;
  /** 0 to 1: how often a follow goes to someone of similar taste rather than anyone. */
  homophily: number;
  /** 0 and up: how strongly enjoyment shows in the words chosen. 0 makes feelings independent of enjoyment. */
  feelingSignal: number;
  /** Share of responses that carry a verdict. */
  verdictRate: number;
  /** Chance that someone who loved a film sends it to a follower. */
  sendRate: number;
  /** On joining, a person is asked about this many well-known films and answers for the ones they have seen. */
  starter: number;
  /** Whether those first answers are readable by others. */
  starterOpen: boolean;
}
export const baseWorld: WorldOptions = { seed: 1, people: 150, films: 400, days: 120, homophily: 0.6, feelingSignal: 1, verdictRate: 0.75, sendRate: 0.25, starter: 0, starterOpen: true };

export interface WorldResponse extends Seen { open: boolean }
export interface World {
  options: WorldOptions;
  people: number[];
  films: number[];
  joined: Map<number, number>;
  responses: WorldResponse[];
  /** [day, follower, followed] */
  follows: [number, number, number][];
  landings: (Landing & { at: number })[];
  /** The hidden truth: how much this person would enjoy this film. */
  enjoyment(personId: number, filmId: number): number;
  verdictOf(value: number): Verdict;
  reach: Map<number, number>;
}

const LOVED = 1, LIKED = 0.2, MIXED = -0.5, K = 6;

function generator(seed: number) {
  let state = seed | 0 || 1;
  const next = () => { state = Math.imul(1664525, state) + 1013904223 | 0; return (state >>> 0) / 4294967296; };
  const normal = () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
  return { next, normal, pick: <T>(list: T[]) => list[Math.floor(next() * list.length)] };
}
// Stable noise for one pair, so the truth is a function and not a draw.
const pairNoise = (seed: number, a: number, b: number) => {
  let h = Math.imul(seed ^ 0x9e3779b9, 2654435761) ^ Math.imul(a + 1, 40503) ^ Math.imul(b + 1, 2246822519);
  h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16;
  const u = ((h >>> 0) + 0.5) / 4294967296, v = ((Math.imul(h, 1597334677) >>> 0) + 0.5) / 4294967296;
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const dot = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * b[i], 0);

export function makeWorld(input: Partial<WorldOptions> = {}): World {
  const options = { ...baseWorld, ...input };
  const { next, normal, pick } = generator(options.seed);
  const clusters = Array.from({ length: 5 }, () => Array.from({ length: K }, normal));
  const people = Array.from({ length: options.people }, (_, i) => i + 1);
  const films = Array.from({ length: options.films }, (_, i) => i + 1);
  const cluster = new Map(people.map(id => [id, Math.floor(next() * clusters.length)]));
  const taste = new Map(people.map(id => [id, clusters[cluster.get(id)!].map(c => Math.sqrt(0.6) * c + Math.sqrt(0.4) * normal())]));
  const style = new Map(people.map(id => [id, WORDS.map(() => normal() * 0.4)]));
  const activity = new Map(people.map(id => [id, 0.04 + 0.5 * next() ** 2.5]));
  const guarded = new Set(people.filter(() => next() < 0.15));
  // Four in ten people arrive part-way through, so there are always newcomers at any moment.
  const joined = new Map(people.map(id => [id, next() < 0.4 ? Math.floor(next() * options.days * 0.95) : 0]));
  const content = new Map(films.map(id => [id, Array.from({ length: K }, normal)]));
  const appeal = new Map(films.map(id => [id, normal() * 0.5]));
  const reach = new Map(films.map(id => [id, Math.exp(normal() + 0.3 * appeal.get(id)!)]));
  const loadings = WORDS.map(() => Array.from({ length: K }, normal));

  const enjoyment = (personId: number, filmId: number) =>
    dot(taste.get(personId)!, content.get(filmId)!) / Math.sqrt(K) + appeal.get(filmId)! + 0.5 * pairNoise(options.seed, personId, filmId);
  const verdictOf = (value: number): Verdict => value > LOVED ? 'loved' : value > LIKED ? 'liked' : value > MIXED ? 'mixed' : 'not_for_me';
  const feelingsOf = (personId: number, filmId: number, value: number) => {
    const pull = WORDS.map((word, w) => ({ word, value: dot(loadings[w], content.get(filmId)!) / Math.sqrt(K)
      + options.feelingSignal * LEAN[w] * value + style.get(personId)![w] + normal() * 0.4 })).sort((a, b) => b.value - a.value);
    return pull.filter((item, index) => index === 0 || (index === 1 && item.value > 0.3) || (index === 2 && item.value > 0.8)).map(item => item.word);
  };

  const followsOf = new Map<number, Set<number>>(people.map(id => [id, new Set<number>()]));
  const followersOf = new Map<number, number[]>(people.map(id => [id, []]));
  const follows: World['follows'] = [];
  const follow = (day: number, a: number, b: number) => {
    if (a === b || followsOf.get(a)!.has(b)) return;
    followsOf.get(a)!.add(b); followersOf.get(b)!.push(a); follows.push([day, a, b]);
  };
  const responses: WorldResponse[] = [];
  const landings: World['landings'] = [];
  const seen = new Map<number, Set<number>>(people.map(id => [id, new Set<number>()]));
  const lovedLately = new Map<number, { filmId: number; day: number }[]>(people.map(id => [id, []]));
  const pending = new Map<number, { fromId: number; filmId: number }[]>(people.map(id => [id, []]));
  const byReach = (power: number) => {
    const weights = films.map(id => reach.get(id)! ** power), total = weights.reduce((s, x) => s + x, 0);
    return () => { let at = next() * total; for (let i = 0; i < films.length; i++) { at -= weights[i]; if (at <= 0) return films[i]; } return films[films.length - 1]; };
  };
  const popular = byReach(1), browse = byReach(0.5);

  const wellKnown = [...films].sort((a, b) => reach.get(b)! - reach.get(a)!).slice(0, 24);
  for (let day = 0; day < options.days; day++) {
    for (const person of people) {
      if (joined.get(person)! > day) continue;
      if (joined.get(person) === day && options.starter) {
        // Shown two dozen well-known films, a person has seen about half and answers for a few of those.
        const known = wellKnown.filter(() => next() < 0.5).slice(0, options.starter);
        for (const filmId of known) {
          seen.get(person)!.add(filmId);
          const value = enjoyment(person, filmId);
          responses.push({ id: responses.length + 1, personId: person, filmId, at: day, feelings: feelingsOf(person, filmId, value), verdict: verdictOf(value), open: options.starterOpen && !guarded.has(person) });
        }
      }
      const here = people.filter(other => joined.get(other)! <= day && other !== person);
      // On arrival, and now and then afterwards, a person follows a few others.
      const wanted = joined.get(person) === day ? 2 + Math.floor(next() * 8) : next() < 0.02 ? 1 : 0;
      for (let n = 0; n < wanted && here.length; n++) {
        const alike = here.filter(other => cluster.get(other) === cluster.get(person));
        follow(day, person, next() < options.homophily && alike.length ? pick(alike) : pick(here));
      }
      if (next() > activity.get(person)!) continue;
      const mine = seen.get(person)!;
      let filmId: number | undefined, sender: number | undefined;
      const waiting = pending.get(person)!;
      const roll = next();
      if (waiting.length && roll < 0.5) { const sent = waiting.shift()!; filmId = sent.filmId; sender = sent.fromId; }
      else if (roll < 0.7) {
        const fresh = [...followsOf.get(person)!].flatMap(friend => lovedLately.get(friend)!.filter(item => day - item.day <= 21 && !mine.has(item.filmId)));
        if (fresh.length) filmId = pick(fresh).filmId;
      }
      if (filmId === undefined) {
        if (next() < 0.4) filmId = popular();
        else {
          // People choose for themselves with a rough idea of what they will like.
          const shortlist = Array.from({ length: 6 }, browse);
          filmId = shortlist.map(id => ({ id, guess: enjoyment(person, id) + normal() })).sort((a, b) => b.guess - a.guess)[0].id;
        }
      }
      if (mine.has(filmId)) continue;
      mine.add(filmId);
      const value = enjoyment(person, filmId), verdict = verdictOf(value);
      const open = next() < (guarded.has(person) ? 0.15 : 0.85);
      const response: WorldResponse = { id: responses.length + 1, personId: person, filmId, at: day,
        feelings: next() < 0.9 ? feelingsOf(person, filmId, value) : [], verdict: next() < options.verdictRate ? verdict : null, open };
      responses.push(response);
      if (open && response.verdict && value > LIKED) lovedLately.get(person)!.push({ filmId, day });
      if (sender !== undefined && next() < 0.7) landings.push({ fromId: sender, toId: person, filmId, verdict, at: day });
      const audience = followersOf.get(person)!;
      if (verdict === 'loved' && audience.length && next() < options.sendRate) {
        // Friends know each other a little: of three followers, the film goes to the one it seems to suit.
        const to = Array.from({ length: 3 }, () => pick(audience)).filter(other => !seen.get(other)!.has(filmId!))
          .map(other => ({ other, guess: enjoyment(other, filmId!) + normal() * 1.2 })).sort((a, b) => b.guess - a.guess)[0];
        if (to) pending.get(to.other)!.push({ fromId: person, filmId });
      }
    }
  }
  return { options, people, films, joined, responses, follows, landings, enjoyment, verdictOf, reach };
}

export const thresholds = { loved: LOVED, liked: LIKED };
