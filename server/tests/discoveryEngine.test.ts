import { describe, expect, it } from '@jest/globals';
import { Community, Seen, commonFeelings, feelingMatch, films, people, recipients, ties, verdictMatch } from '../src/discovery/engine';
import { anyFilm, engine, previous, score, snapshot } from '../src/evaluation/lab';
import { makeWorld } from '../src/evaluation/world';

let next = 0;
const seen = (personId: number, filmId: number, verdict: Seen['verdict'], feelings: string[] = []): Seen => ({ id: ++next, personId, filmId, verdict, feelings, at: next });
const community = (input: Partial<Community>): Community => ({ viewerId: 1, own: [], others: [], follows: new Map(), landings: [], hidden: new Set(), ...input });

describe('discovery engine', () => {
  it('compares words by order and verdicts by distance, and says nothing when there is nothing to compare', () => {
    expect(feelingMatch(['tension', 'wonder'], ['tension', 'wonder'])).toBe(1);
    expect(feelingMatch(['tension', 'wonder'], ['wonder', 'tension'])).toBeLessThan(1);
    expect(feelingMatch(['tension'], ['joy'])).toBe(0);
    expect(feelingMatch([], ['joy'])).toBeNull();
    expect(commonFeelings(['joy', 'tension', 'wonder'], ['wonder', 'tension'])).toEqual(['tension', 'wonder']);
    expect(verdictMatch('loved', 'loved')).toBe(1);
    expect(verdictMatch('loved', 'not_for_me')).toBe(0);
    expect(verdictMatch('loved', null)).toBeNull();
  });

  it('offers nothing through a stranger, and offers a film through someone who felt the same about a shared one', () => {
    const base = { own: [seen(1, 10, 'loved', ['tension', 'wonder'])] };
    const stranger = community({ ...base, others: [seen(2, 20, 'loved')] });
    expect(films(stranger)).toEqual([]);
    const kindred = community({ ...base, others: [seen(2, 10, 'loved', ['tension']), seen(2, 20, 'loved', ['joy'])] });
    const [pick] = films(kindred);
    expect(pick.filmId).toBe(20);
    expect(pick.paths[0]).toMatchObject({ personId: 2, verdict: 'loved', reason: { kind: 'shared', film: { filmId: 10, feelings: ['tension'] } } });
  });

  it('never offers a film the viewer has responded to or set aside', () => {
    const c = community({ own: [seen(1, 10, 'loved'), seen(1, 20, 'mixed')], follows: new Map([[1, new Set([2])]]),
      others: [seen(2, 20, 'loved'), seen(2, 30, 'loved'), seen(2, 40, 'loved')], hidden: new Set([30]) });
    expect(films(c).map(pick => pick.filmId)).toEqual([40]);
  });

  it('puts a film someone loved above one they were mixed on, and leaves out one they said was not for them', () => {
    const c = community({ follows: new Map([[1, new Set([2])]]), others: [seen(2, 20, 'mixed'), seen(2, 30, 'loved'), seen(2, 40, 'not_for_me'), seen(2, 50, null)] });
    expect(films(c).map(pick => pick.filmId)).toEqual([30, 50, 20]);
  });

  it('reaches a person with an empty diary through the people they follow', () => {
    const c = community({ follows: new Map([[1, new Set([2])]]), others: [seen(2, 20, 'loved')] });
    expect(films(c)[0].paths[0].reason).toEqual({ kind: 'following' });
  });

  it('trusts a person whose pick landed more than one whose pick did not, and says so', () => {
    const c = community({ follows: new Map([[1, new Set([2, 3])]]), others: [seen(2, 20, 'loved'), seen(3, 30, 'loved')],
      landings: [{ fromId: 2, toId: 1, filmId: 90, verdict: 'loved' }, { fromId: 3, toId: 1, filmId: 91, verdict: 'not_for_me' }] });
    const [first, second] = films(c);
    expect([first.filmId, second.filmId]).toEqual([20, 30]);
    expect(first.paths[0].reason).toEqual({ kind: 'landed', filmId: 90, verdict: 'loved' });
  });

  it('weakens a person the viewer disagrees with until they are no longer a source', () => {
    const own = [seen(1, 10, 'loved', ['joy']), seen(1, 11, 'loved', ['joy']), seen(1, 12, 'not_for_me', ['still'])];
    const c = community({ own, others: [seen(2, 10, 'not_for_me', ['still']), seen(2, 11, 'not_for_me', ['friction']), seen(2, 12, 'loved', ['joy']), seen(2, 20, 'loved')] });
    expect(ties(c)[0].weight).toBeLessThan(0.36);
    expect(films(c)).toEqual([]);
  });

  it('lets a few people add to a film without letting a crowd decide, and lowers it when a trusted person disliked it', () => {
    const follows = new Map([[1, new Set([2, 3, 4, 5, 6, 7])]]);
    const crowd = [2, 3, 4, 5, 6].map(person => seen(person, 20, 'liked'));
    const c = community({ follows, others: [...crowd, seen(7, 30, 'loved')] });
    const many = films(c).find(pick => pick.filmId === 20)!, one = films(c).find(pick => pick.filmId === 30)!;
    expect(many.paths).toHaveLength(5);
    expect(many.score).toBeGreaterThan(one.score);
    const three = films(community({ follows, others: crowd.slice(0, 3) }))[0];
    expect(many.score).toBeCloseTo(three.score, 10);
    const split = films(community({ follows, others: [...crowd.slice(0, 3), seen(7, 20, 'not_for_me')] }))[0];
    expect(split.score).toBeLessThan(three.score);
    expect(split.against).toEqual([7]);
  });

  it('does not let one person lead film after film when someone else has something close', () => {
    const follows = new Map([[1, new Set([2, 3])]]);
    const c = community({ follows, landings: [{ fromId: 2, toId: 1, filmId: 90, verdict: 'loved' }],
      others: [seen(2, 20, 'loved'), seen(2, 21, 'loved'), seen(2, 22, 'loved'), seen(3, 30, 'loved')] });
    const leaders = films(c).map(pick => pick.paths[0].personId);
    expect(leaders.indexOf(3)).toBeLessThan(3);
    expect(leaders[0]).toBe(2);
  });

  it('introduces people through a shared film, through friends, or because they follow the viewer, and never someone already followed', () => {
    const c = community({ own: [seen(1, 10, 'loved', ['wonder'])], follows: new Map([[1, new Set([2])], [2, new Set([3])], [5, new Set([1])]]),
      others: [seen(4, 10, 'loved', ['wonder']), seen(2, 10, 'loved'), seen(6, 99, 'loved')] });
    const found = people(c);
    expect(found.map(person => person.personId).sort()).toEqual([3, 4, 5]);
    expect(found.find(person => person.personId === 4)!.shared).toMatchObject({ filmId: 10, feelings: ['wonder'] });
    expect(found.find(person => person.personId === 3)!.mutuals).toEqual([2]);
    expect(found.find(person => person.personId === 5)!.followsYou).toBe(true);
  });

  it('suggests who to send a film to, leaving out people who have already written about it', () => {
    const c = community({ own: [seen(1, 10, 'loved', ['wonder'])], landings: [{ fromId: 1, toId: 3, filmId: 90, verdict: 'loved' }],
      others: [seen(2, 10, 'loved', ['wonder']), seen(4, 50, 'liked')] });
    const offered = recipients(c, 50, [2, 3, 4, 5]);
    expect(offered.map(person => person.personId)).toEqual([2, 3, 5]);
    expect(offered[0].reason).toMatchObject({ kind: 'shared', film: { filmId: 10 } });
    expect(offered[1].reason).toEqual({ kind: 'returned', filmId: 90, verdict: 'loved' });
    expect(offered[2].reason).toBeNull();
  });

  it('gives the same answer whatever order the rows arrive in', () => {
    const rows = [seen(2, 10, 'loved', ['joy']), seen(2, 20, 'loved'), seen(3, 10, 'liked', ['joy']), seen(3, 30, 'loved'), seen(3, 20, 'liked')];
    const base = { own: [seen(1, 10, 'loved', ['joy'])] };
    expect(films(community({ ...base, others: [...rows].reverse() }))).toEqual(films(community({ ...base, others: rows })));
  });
});

describe('discovery lab', () => {
  const shot = snapshot(makeWorld({ seed: 5, people: 60, films: 200 }));
  it('builds the same world from the same seed', () => {
    const again = makeWorld({ seed: 5, people: 60, films: 200 });
    expect(again.responses).toEqual(shot.world.responses);
    expect(again.follows).toEqual(shot.world.follows);
  });
  it('shows the engine finding more films people would like than chance or the engine before it, for everyone including newcomers', () => {
    const now = score(engine(), shot), before = score(previous, shot), chance = score(anyFilm, shot);
    expect(now.reached).toBe(1);
    expect(now.yield).toBeGreaterThan(before.yield + 0.5);
    expect(now.yield).toBeGreaterThan(chance.yield + 0.5);
    expect(now.personal).toBeGreaterThan(0);
    expect(before.byDiary.empty).toBe(0);
  });
});
