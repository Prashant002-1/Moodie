/**
 * Runs ranking strategies through a simulated community and scores what they offer.
 *
 * The clock stops four fifths of the way through the world. Each strategy sees
 * only what was readable then, and is judged against the hidden truth: of the
 * five films it puts first for a person, how many would that person really
 * have liked.
 */
import { Community, Seen, Tuning, defaults, films, ties } from '../discovery/engine';
import { aggregatePathLoss, expectedLoss, LearningResponse, predictTransfer, SharedResponse, trainTransferModel, TransferModel } from '../services/emotionalLearning';
import { World, WORDS, thresholds } from './world';

const TOP = 5;

export interface Snapshot {
  world: World;
  cutoff: number;
  readable: Seen[];
  byPerson: Map<number, Seen[]>;
  follows: Map<number, Set<number>>;
  communities: Map<number, Community>;
}

export function snapshot(world: World, cutoff = Math.floor(world.options.days * 0.8)): Snapshot {
  const byPerson = new Map<number, Seen[]>();
  const readable: Seen[] = [];
  for (const row of world.responses) {
    if (row.at >= cutoff) continue;
    const list = byPerson.get(row.personId); if (list) list.push(row); else byPerson.set(row.personId, [row]);
    if (row.open) readable.push(row);
  }
  const follows = new Map<number, Set<number>>();
  for (const [day, a, b] of world.follows) if (day < cutoff) { const set = follows.get(a); if (set) set.add(b); else follows.set(a, new Set([b])); }
  return { world, cutoff, readable, byPerson, follows, communities: new Map() };
}

export function communityFor(shot: Snapshot, viewerId: number): Community {
  const held = shot.communities.get(viewerId);
  if (held) return held;
  const made: Community = { viewerId, own: shot.byPerson.get(viewerId) ?? [], others: shot.readable.filter(row => row.personId !== viewerId),
    follows: shot.follows, hidden: new Set(),
    landings: shot.world.landings.filter(l => l.at < shot.cutoff && (l.fromId === viewerId || l.toId === viewerId)) };
  shot.communities.set(viewerId, made);
  return made;
}

export interface Offer { filmId: number; lead?: number }
export type Strategy = (community: Community, shot: Snapshot) => Offer[];

const unseen = (community: Community) => { const mine = new Set(community.own.map(row => row.filmId)); return (filmId: number) => !mine.has(filmId); };
const counts = (rows: Seen[]) => { const map = new Map<number, number>(); for (const row of rows) map.set(row.filmId, (map.get(row.filmId) ?? 0) + 1); return map; };

/** Any film someone has written about, in an arbitrary fixed order. The floor. */
export const anyFilm: Strategy = (community, shot) => {
  const open = unseen(community);
  return [...counts(shot.readable).keys()].filter(open)
    .sort((a, b) => (Math.imul(a + community.viewerId, 2654435761) >>> 0) - (Math.imul(b + community.viewerId, 2654435761) >>> 0)).map(filmId => ({ filmId }));
};
/** The films most people have written about. Moodie does not offer this; it is here to be measured against. */
export const mostWritten: Strategy = (community, shot) => {
  const open = unseen(community);
  return [...counts(shot.readable)].filter(([filmId]) => open(filmId)).sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([filmId]) => ({ filmId }));
};
/** The films with the warmest verdicts overall, the same list for everyone. Also only a yardstick. */
export const bestLoved: Strategy = (community, shot) => {
  const open = unseen(community), tally = new Map<number, { good: number; all: number }>();
  for (const row of shot.readable) {
    if (!row.verdict) continue;
    const item = tally.get(row.filmId) ?? { good: 0, all: 0 }; tally.set(row.filmId, item);
    item.all++; if (row.verdict === 'loved' || row.verdict === 'liked') item.good++;
  }
  return [...tally].filter(([filmId]) => open(filmId)).map(([filmId, t]) => ({ filmId, value: (t.good + 1) / (t.all + 3) }))
    .sort((a, b) => b.value - a.value || a.filmId - b.filmId).map(({ filmId }) => ({ filmId }));
};

export const engine = (tuning: Partial<Omit<Tuning, 'use'>> & { use?: Partial<Tuning['use']> } = {}): Strategy => {
  const merged: Tuning = { ...defaults, ...tuning, use: { ...defaults.use, ...tuning.use } };
  return community => films(community, merged).map(pick => ({ filmId: pick.filmId, lead: pick.paths[0].personId }));
};

// The engine Moodie shipped before this one, on the same inputs: people who share a feeling on a shared film,
// ordered by how far the two differ, with no verdicts, follows or history of what landed.
const asVector = (words: string[]) => WORDS.map(word => [1, 0.6, 0.3][words.indexOf(word)] ?? 0);
const asLearning = (row: Seen): LearningResponse => ({ id: row.id, userId: row.personId, movieId: row.filmId, values: asVector(row.feelings), availableAt: row.at, watchedAt: row.at });
const models = new WeakMap<Snapshot, TransferModel>();
export const previous: Strategy = (community, shot) => {
  let model = models.get(shot);
  if (!model) { model = trainTransferModel(shot.readable.filter(row => row.feelings.length).map(asLearning)); models.set(shot, model); }
  const own = new Map(community.own.filter(row => row.feelings.length).map(row => [row.filmId, asLearning(row)]));
  const everyFilm = new Set(community.own.map(row => row.filmId));
  const byPerson = new Map<number, LearningResponse[]>();
  for (const row of community.others) if (row.feelings.length) { const list = byPerson.get(row.personId) ?? []; list.push(asLearning(row)); byPerson.set(row.personId, list); }
  const byFilm = new Map<number, { loss: number; variance: number; person: number }[]>();
  for (const [person, rows] of byPerson) {
    const shared: SharedResponse[] = rows.flatMap(row => { const mine = own.get(row.movieId); return mine ? [{ viewer: mine, person: row }] : []; });
    if (!shared.some(pair => pair.viewer.values.some((value, d) => Math.min(value, pair.person.values[d]) >= 0.06))) continue;
    for (const row of rows) {
      if (everyFilm.has(row.movieId)) continue;
      const prediction = predictTransfer(model, shared, row.values);
      const list = byFilm.get(row.movieId) ?? []; byFilm.set(row.movieId, list);
      list.push({ loss: expectedLoss(prediction, row.values), variance: prediction.variance.reduce((s, v) => s + v, 0) / 7, person });
    }
  }
  return [...byFilm].map(([filmId, paths]) => { paths.sort((a, b) => a.loss - b.loss || a.person - b.person); return { filmId, loss: aggregatePathLoss(paths), lead: paths[0].person }; })
    .sort((a, b) => a.loss - b.loss || a.filmId - b.filmId).map(({ filmId, lead }) => ({ filmId, lead }));
};

/** The same engine, told the truth about how alike two people are. Shows how much better knowledge of people could buy. */
export const allKnowing: Strategy = (community, shot) => {
  const { world } = shot, sample = world.films.filter((_, index) => index % 4 === 0);
  const mine = sample.map(filmId => world.enjoyment(community.viewerId, filmId));
  const alike = (personId: number) => {
    const theirs = sample.map(filmId => world.enjoyment(personId, filmId));
    const ma = mine.reduce((s, x) => s + x, 0) / mine.length, mb = theirs.reduce((s, x) => s + x, 0) / theirs.length;
    let top = 0, a = 0, b = 0;
    for (let i = 0; i < mine.length; i++) { top += (mine[i] - ma) * (theirs[i] - mb); a += (mine[i] - ma) ** 2; b += (theirs[i] - mb) ** 2; }
    return top / Math.sqrt(a * b);
  };
  const known = ties(community).map(tie => ({ ...tie, weight: Math.max(0, alike(tie.personId)) })).sort((a, b) => b.weight - a.weight);
  return films(community, { ...defaults, floor: 0.05 }, known).map(pick => ({ filmId: pick.filmId, lead: pick.paths[0].personId }));
};

export interface Score {
  /** Share of people offered at least one film, and at least five. */
  reached: number; filled: number;
  /** Of the first five offered, the share the person would have liked or loved; and loved. Only people offered something. */
  liked: number; loved: number;
  /** Films a person would have liked among the first five, averaged over everyone, people offered nothing included. */
  yield: number;
  /** Liked films in the first five that are not among the most written-about twentieth: what a person would not have met anyway. */
  finds: number;
  /** Yield minus the yield of handing each person somebody else's list: how much of it is really about them. */
  personal: number;
  /** Different people leading the first five (strategies that name a person). */
  voices: number | null;
  /** Share of first-five places taken by the twentieth of films most written about. */
  crowded: number;
  /** Different films offered across everyone, as a share of films anyone has written about. */
  range: number;
  /** The same yield for people with an empty diary, one to three films, and more. */
  byDiary: { empty: number; few: number; many: number };
}

export function score(strategy: Strategy, shot: Snapshot): Score {
  const { world } = shot;
  const viewers = world.people.filter(id => world.joined.get(id)! < shot.cutoff);
  const written = counts(shot.readable);
  const crowd = new Set([...written].sort((a, b) => b[1] - a[1]).slice(0, Math.max(1, Math.ceil(written.size / 20))).map(([filmId]) => filmId));
  let reached = 0, filled = 0, liked = 0, loved = 0, total = 0, voices = 0, named = 0, crowded = 0, places = 0, finds = 0, swapped = 0, swaps = 0, kept = 0;
  const lists = new Map<number, Offer[]>();
  for (const viewerId of viewers) lists.set(viewerId, strategy(communityFor(shot, viewerId), shot));
  const withList = viewers.filter(id => lists.get(id)!.length);
  const offered = new Set<number>();
  const groups = { empty: [0, 0], few: [0, 0], many: [0, 0] };
  for (const viewerId of viewers) {
    const community = communityFor(shot, viewerId);
    const top = lists.get(viewerId)!.slice(0, TOP);
    if (top.length && withList.length > 1) {
      // The same person's diary, somebody else's list.
      const mine = new Set(community.own.map(row => row.filmId));
      const other = withList[(withList.indexOf(viewerId) + 1 + viewerId % (withList.length - 1)) % withList.length];
      const theirs = lists.get(other === viewerId ? withList[(withList.indexOf(viewerId) + 1) % withList.length] : other)!.filter(offer => !mine.has(offer.filmId)).slice(0, top.length);
      swapped += theirs.filter(offer => world.enjoyment(viewerId, offer.filmId) > thresholds.liked).length; swaps++;
      kept += top.filter(offer => world.enjoyment(viewerId, offer.filmId) > thresholds.liked).length;
    }
    const good = top.filter(offer => world.enjoyment(viewerId, offer.filmId) > thresholds.liked).length;
    const great = top.filter(offer => world.enjoyment(viewerId, offer.filmId) > thresholds.loved).length;
    const group = groups[community.own.length === 0 ? 'empty' : community.own.length <= 3 ? 'few' : 'many'];
    group[0] += good; group[1]++;
    total += good;
    if (!top.length) continue;
    reached++; if (top.length === TOP) filled++;
    liked += good / top.length; loved += great / top.length;
    for (const offer of top) { offered.add(offer.filmId); places++; if (crowd.has(offer.filmId)) crowded++; else if (world.enjoyment(viewerId, offer.filmId) > thresholds.liked) finds++; }
    if (top[0].lead !== undefined) { named++; voices += new Set(top.map(offer => offer.lead)).size / top.length * TOP; }
  }
  const mean = ([sum, n]: number[]) => n ? sum / n : 0;
  return { reached: reached / viewers.length, filled: filled / viewers.length, liked: reached ? liked / reached : 0, loved: reached ? loved / reached : 0,
    yield: total / viewers.length, finds: finds / viewers.length, personal: swaps ? (kept - swapped) / swaps : 0, voices: named ? voices / named : null, crowded: places ? crowded / places : 0, range: offered.size / Math.max(1, written.size),
    byDiary: { empty: mean(groups.empty), few: mean(groups.few), many: mean(groups.many) } };
}

/** What a perfect guide could do with the same shelf: the five films each person would enjoy most. */
export function ceiling(shot: Snapshot): number {
  const { world } = shot, shelf = [...counts(shot.readable).keys()];
  const viewers = world.people.filter(id => world.joined.get(id)! < shot.cutoff);
  let total = 0;
  for (const viewerId of viewers) {
    const mine = new Set((shot.byPerson.get(viewerId) ?? []).map(row => row.filmId));
    total += shelf.filter(filmId => !mine.has(filmId)).map(filmId => world.enjoyment(viewerId, filmId)).sort((a, b) => b - a).slice(0, TOP).filter(value => value > thresholds.liked).length;
  }
  return total / viewers.length;
}

export const average = (scores: Score[]): Score => {
  const mean = (read: (s: Score) => number) => scores.reduce((sum, s) => sum + read(s), 0) / scores.length;
  return { reached: mean(s => s.reached), filled: mean(s => s.filled), liked: mean(s => s.liked), loved: mean(s => s.loved), yield: mean(s => s.yield), finds: mean(s => s.finds), personal: mean(s => s.personal),
    voices: scores[0].voices === null ? null : mean(s => s.voices ?? 0), crowded: mean(s => s.crowded), range: mean(s => s.range),
    byDiary: { empty: mean(s => s.byDiary.empty), few: mean(s => s.byDiary.few), many: mean(s => s.byDiary.many) } };
};
