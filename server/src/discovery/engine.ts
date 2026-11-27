/**
 * Discovery through people. Pure functions: no database, no clock, no catalog.
 *
 * Everything Moodie offers a person reaches them through someone: a person they
 * follow, a person whose picks landed with them before, or a person who
 * responded the way they did to a film both have seen. This module turns what
 * people wrote down into those paths and orders them.
 *
 * Feelings are an ordered list of words, strongest first. The engine never
 * looks inside a word, so the vocabulary can change without touching it.
 * Nothing computed here is shown as a number: weights only decide order.
 */

export type Verdict = 'loved' | 'liked' | 'mixed' | 'not_for_me';

/** One person's current response to one film. */
export interface Seen {
  id: number;
  personId: number;
  filmId: number;
  /** Words the person chose, strongest first. */
  feelings: string[];
  verdict: Verdict | null;
  /** When this version became readable (ms). Only used to break ties and prefer the recent. */
  at: number;
}

/** A film one person sent another, which the recipient then watched and judged. */
export interface Landing {
  fromId: number;
  toId: number;
  filmId: number;
  verdict: Verdict;
}

/** Everything the engine may know when it answers one person. The loader decides what is allowed in. */
export interface Community {
  viewerId: number;
  /** The viewer's own responses, private ones included: latest per film. */
  own: Seen[];
  /** Other people's public responses: latest per person and film. */
  others: Seen[];
  /** Who follows whom, viewer included: follower id -> followed ids. */
  follows: Map<number, Set<number>>;
  /** Judged recommendations between the viewer and one other person, in either direction. */
  landings: Landing[];
  /** Films the viewer has said are not for them. Never offered again. */
  hidden: Set<number>;
}

export interface Tuning {
  /** What an untested person is worth, and how many films of evidence it takes to move off that. */
  priorMean: number;
  priorStrength: number;
  /** Following someone counts as this many agreeing films. */
  followEvidence: number;
  /** A person needs at least this weight to be a source. */
  floor: number;
  /** How much each verdict endorses a film. A response with no verdict is `none`. */
  endorse: Record<Verdict | 'none', number>;
  /** How far a trusted person's "not for me" pulls a film down. */
  veto: number;
  /** Each further film led by the same person is worth this much less, so one voice does not fill the list. */
  repeat: number;
  /** How many people pointing at one film count towards it: 1 keeps only the strongest, more lets each add a little. */
  voices: number;
  use: { feelings: boolean; verdicts: boolean; follows: boolean; landings: boolean };
}

export const defaults: Tuning = {
  priorMean: 0.35,
  priorStrength: 2,
  followEvidence: 1,
  floor: 0.36,
  endorse: { loved: 1, liked: 0.7, none: 0.45, mixed: 0.15, not_for_me: 0 },
  veto: 0.5,
  repeat: 0.7,
  voices: 3,
  use: { feelings: true, verdicts: true, follows: true, landings: true },
};

const ORDER = [1, 0.6, 0.3];
const WARMTH: Record<Verdict, number> = { loved: 1, liked: 0.7, mixed: 0.3, not_for_me: 0 };

/** Words two people both chose for a film, the ones both put first leading. */
export function commonFeelings(a: string[], b: string[]): string[] {
  return a.filter(word => b.includes(word))
    .sort((x, y) => (a.indexOf(x) + b.indexOf(x)) - (a.indexOf(y) + b.indexOf(y)) || x.localeCompare(y));
}

/** 0 to 1: how far two ordered lists of words overlap, the first word counting most. Null when either is empty. */
export function feelingMatch(a: string[], b: string[]): number | null {
  if (!a.length || !b.length) return null;
  const weight = (list: string[], word: string) => ORDER[list.indexOf(word)] ?? (list.includes(word) ? 0.15 : 0);
  const total = (list: string[]) => list.reduce((sum, word) => sum + weight(list, word), 0);
  const both = a.filter(word => b.includes(word)).reduce((sum, word) => sum + Math.min(weight(a, word), weight(b, word)), 0);
  return both / Math.max(total(a), total(b));
}

/** 0 to 1: how close two verdicts are. Null when either person gave none. */
export function verdictMatch(a: Verdict | null, b: Verdict | null): number | null {
  return a && b ? 1 - Math.abs(WARMTH[a] - WARMTH[b]) : null;
}

export interface SharedFilm {
  filmId: number;
  ownId: number;
  theirId: number;
  /** Words both chose. */
  feelings: string[];
  ownVerdict: Verdict | null;
  theirVerdict: Verdict | null;
  /** 0 to 1, or null when the two responses have nothing comparable. */
  match: number | null;
}

/** What connects the viewer to one other person. */
export interface Tie {
  personId: number;
  /** 0 to 1. Orders people and films; never shown. */
  weight: number;
  agree: number;
  differ: number;
  /** Films both responded to, closest first. */
  shared: SharedFilm[];
  /** Films this person sent the viewer, with the viewer's verdict. */
  landed: Landing[];
  /** Films the viewer sent this person, with their verdict. */
  returned: Landing[];
  following: boolean;
  followsYou: boolean;
  /** People the viewer follows who follow this person. */
  mutuals: number[];
}

const latestByFilm = (rows: Seen[]) => {
  const map = new Map<number, Seen>();
  for (const row of rows) { const held = map.get(row.filmId); if (!held || row.at > held.at || (row.at === held.at && row.id > held.id)) map.set(row.filmId, row); }
  return map;
};

/** Every person the viewer has something in common with, strongest first. */
export function ties(community: Community, tuning: Tuning = defaults): Tie[] {
  const { viewerId } = community;
  const own = latestByFilm(community.own);
  const byPerson = new Map<number, Seen[]>();
  for (const row of community.others) {
    if (row.personId === viewerId) continue;
    const list = byPerson.get(row.personId); if (list) list.push(row); else byPerson.set(row.personId, [row]);
  }
  const following = community.follows.get(viewerId) ?? new Set<number>();
  const people = new Set<number>([...byPerson.keys(), ...following]);
  for (const landing of community.landings) people.add(landing.fromId === viewerId ? landing.toId : landing.fromId);
  for (const [follower, followed] of community.follows) if (followed.has(viewerId)) people.add(follower);
  // Friends of friends: one step out, no further.
  for (const friend of following) for (const theirs of community.follows.get(friend) ?? []) people.add(theirs);
  people.delete(viewerId);

  const result: Tie[] = [];
  for (const personId of people) {
    let agree = 0, differ = 0;
    const shared: SharedFilm[] = [];
    for (const theirs of latestByFilm(byPerson.get(personId) ?? []).values()) {
      const mine = own.get(theirs.filmId);
      if (!mine) continue;
      const parts = [tuning.use.feelings ? feelingMatch(mine.feelings, theirs.feelings) : null,
        tuning.use.verdicts ? verdictMatch(mine.verdict, theirs.verdict) : null].filter((x): x is number => x !== null);
      const match = parts.length ? parts.reduce((sum, x) => sum + x, 0) / parts.length : null;
      shared.push({ filmId: theirs.filmId, ownId: mine.id, theirId: theirs.id, feelings: commonFeelings(mine.feelings, theirs.feelings),
        ownVerdict: mine.verdict, theirVerdict: theirs.verdict, match });
      if (match === null) continue;
      agree += match; differ += 1 - match;
    }
    shared.sort((a, b) => (b.match ?? -1) - (a.match ?? -1) || b.feelings.length - a.feelings.length || a.filmId - b.filmId);
    const landed = community.landings.filter(l => l.fromId === personId && l.toId === viewerId);
    const returned = community.landings.filter(l => l.fromId === viewerId && l.toId === personId);
    if (tuning.use.landings) {
      // A pick that was actually tried is the most direct evidence there is, in both directions.
      for (const [list, worth] of [[landed, 1.5], [returned, 0.75]] as const) for (const landing of list) {
        agree += worth * WARMTH[landing.verdict]; differ += worth * (1 - WARMTH[landing.verdict]);
      }
    }
    const follows = following.has(personId);
    if (tuning.use.follows && follows) agree += tuning.followEvidence;
    const evidence = agree + differ;
    const weight = evidence ? (agree + tuning.priorMean * tuning.priorStrength) / (evidence + tuning.priorStrength) : 0;
    const theirFollowers = [...following].filter(friend => friend !== personId && community.follows.get(friend)?.has(personId));
    result.push({ personId, weight, agree, differ, shared, landed, returned, following: follows,
      followsYou: Boolean(community.follows.get(personId)?.has(viewerId)), mutuals: theirFollowers.sort((a, b) => a - b) });
  }
  return result.sort((a, b) => b.weight - a.weight || a.personId - b.personId);
}

/** Why this person, in the most concrete terms available. */
export type Reason =
  | { kind: 'landed'; filmId: number; verdict: Verdict }
  | { kind: 'shared'; film: SharedFilm }
  | { kind: 'following' };

export function reasonFor(tie: Tie): Reason | null {
  const hit = tie.landed.find(l => l.verdict === 'loved') ?? tie.landed.find(l => l.verdict === 'liked');
  if (hit) return { kind: 'landed', filmId: hit.filmId, verdict: hit.verdict };
  const close = tie.shared.find(film => (film.match ?? 0) >= 0.5);
  if (close) return { kind: 'shared', film: close };
  if (tie.following) return { kind: 'following' };
  const any = tie.shared.find(film => film.match !== null && film.match > 0);
  return any ? { kind: 'shared', film: any } : null;
}

export interface Path {
  personId: number;
  responseId: number;
  verdict: Verdict | null;
  feelings: string[];
  strength: number;
  reason: Reason;
}
export interface Pick {
  filmId: number;
  score: number;
  /** Everyone this film reaches the viewer through, strongest first. Never empty. */
  paths: Path[];
  /** Trusted people who said it was not for them. Shown, not hidden: disagreement is a response too. */
  against: number[];
}

/** Films the viewer has not responded to, through the people they have something in common with. */
export function films(community: Community, tuning: Tuning = defaults, known: Tie[] = ties(community, tuning)): Pick[] {
  const sources = new Map(known.filter(tie => tie.weight >= tuning.floor).map(tie => [tie.personId, tie]));
  const seen = new Set(community.own.map(row => row.filmId));
  const byFilm = new Map<number, { paths: Path[]; against: { personId: number; weight: number }[] }>();
  const latest = new Map<string, Seen>();
  for (const row of community.others) {
    const key = `${row.personId}/${row.filmId}`, held = latest.get(key);
    if (!held || row.at > held.at || (row.at === held.at && row.id > held.id)) latest.set(key, row);
  }
  for (const row of latest.values()) {
    if (seen.has(row.filmId) || community.hidden.has(row.filmId)) continue;
    const tie = sources.get(row.personId);
    if (!tie) continue;
    const reason = reasonFor(tie);
    if (!reason) continue;
    const group = byFilm.get(row.filmId) ?? { paths: [], against: [] };
    byFilm.set(row.filmId, group);
    if (tuning.use.verdicts && row.verdict === 'not_for_me') { group.against.push({ personId: row.personId, weight: tie.weight }); continue; }
    const endorse = tuning.use.verdicts ? tuning.endorse[row.verdict ?? 'none'] : tuning.endorse.none;
    group.paths.push({ personId: row.personId, responseId: row.id, verdict: row.verdict, feelings: row.feelings, strength: tie.weight * endorse, reason });
  }
  const picks: Pick[] = [];
  for (const [filmId, { paths, against }] of byFilm) {
    if (!paths.length) continue;
    paths.sort((a, b) => b.strength - a.strength || a.personId - b.personId);
    const lift = 1 - paths.slice(0, tuning.voices).reduce((miss, path) => miss * (1 - path.strength), 1);
    const drag = against.reduce((keep, no) => keep * (1 - tuning.veto * no.weight), 1);
    picks.push({ filmId, score: lift * drag, paths, against: against.map(no => no.personId) });
  }
  picks.sort((a, b) => b.score - a.score || a.filmId - b.filmId);
  return tuning.repeat < 1 ? spread(picks, tuning.repeat) : picks;
}

/** Reorder so the same person does not lead film after film: each repeat is worth a little less. */
export function spread(picks: Pick[], repeat: number): Pick[] {
  const led = new Map<number, number>();
  const rest = [...picks], out: Pick[] = [];
  while (rest.length) {
    let best = 0, value = -1;
    for (let i = 0; i < rest.length; i++) {
      const worth = rest[i].score * repeat ** (led.get(rest[i].paths[0].personId) ?? 0);
      if (worth > value) { value = worth; best = i; }
      // Scores only fall from here, so nothing later can beat an unpenalised leader.
      if (rest[i].score <= value) break;
    }
    const [pick] = rest.splice(best, 1);
    led.set(pick.paths[0].personId, (led.get(pick.paths[0].personId) ?? 0) + 1);
    out.push(pick);
  }
  return out;
}

export interface Introduction {
  personId: number;
  score: number;
  /** The closest film both responded to, when there is one. */
  shared: SharedFilm | null;
  sharedCount: number;
  /** People the viewer follows who follow this person. */
  mutuals: number[];
  followsYou: boolean;
}

/** People the viewer does not follow yet and has a reason to. */
export function people(community: Community, tuning: Tuning = defaults, known: Tie[] = ties(community, tuning)): Introduction[] {
  const out: Introduction[] = [];
  for (const tie of known) {
    if (tie.following) continue;
    const shared = tie.shared.find(film => (film.match ?? 0) > 0) ?? null;
    const kindred = shared && tie.weight >= tuning.floor ? tie.weight : 0;
    if (!kindred && !tie.mutuals.length && !tie.followsYou) continue;
    const score = 1 - (1 - kindred) * 0.75 ** tie.mutuals.length * (tie.followsYou ? 0.8 : 1);
    out.push({ personId: tie.personId, score, shared, sharedCount: tie.shared.length, mutuals: tie.mutuals, followsYou: tie.followsYou });
  }
  return out.sort((a, b) => b.score - a.score || a.personId - b.personId);
}

export interface Recipient {
  personId: number;
  score: number;
  /** What suggests they would want it: something the viewer sent that they loved, or a film both felt alike about. */
  reason: { kind: 'returned'; filmId: number; verdict: Verdict } | { kind: 'shared'; film: SharedFilm } | null;
}

/**
 * Who, among the people who can receive a recommendation from the viewer, to offer first for one film.
 * People who have already written about the film in public are left out.
 */
export function recipients(community: Community, filmId: number, eligible: number[], tuning: Tuning = defaults, known: Tie[] = ties(community, tuning)): Recipient[] {
  const byId = new Map(known.map(tie => [tie.personId, tie]));
  const wrote = new Set(community.others.filter(row => row.filmId === filmId).map(row => row.personId));
  const out: Recipient[] = [];
  for (const personId of eligible) {
    if (wrote.has(personId) || personId === community.viewerId) continue;
    const tie = byId.get(personId);
    const hit = tie?.returned.find(l => l.verdict === 'loved') ?? tie?.returned.find(l => l.verdict === 'liked');
    const close = tie?.shared.find(film => (film.match ?? 0) >= 0.5);
    out.push({ personId, score: tie?.weight ?? 0,
      reason: hit ? { kind: 'returned', filmId: hit.filmId, verdict: hit.verdict } : close ? { kind: 'shared', film: close } : null });
  }
  return out.sort((a, b) => Number(Boolean(b.reason)) - Number(Boolean(a.reason)) || b.score - a.score || a.personId - b.personId);
}
