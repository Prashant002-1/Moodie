/**
 * npm run discovery:lab
 * Compares ranking strategies across simulated communities and writes docs/discovery-lab.json.
 * Reads no account data and calls no service.
 */
import { writeFile } from 'fs/promises';
import path from 'path';
import { allKnowing, anyFilm, average, bestLoved, ceiling, engine, mostWritten, previous, score, snapshot, Strategy } from '../evaluation/lab';
import { makeWorld, WorldOptions } from '../evaluation/world';

const strategies: [string, Strategy][] = [
  ['any film', anyFilm],
  ['most written about', mostWritten],
  ['best loved overall', bestLoved],
  ['previous engine', previous],
  ['feelings only', engine({ use: { verdicts: false, follows: false, landings: false } })],
  ['verdicts only', engine({ use: { feelings: false, follows: false, landings: false } })],
  ['feelings + verdicts', engine({ use: { follows: false, landings: false } })],
  ['follows only', engine({ use: { feelings: false, verdicts: false, landings: false } })],
  ['+ follows', engine({ use: { landings: false } })],
  ['+ what landed (all)', engine()],
  ['all, one voice per film', engine({ voices: 1 })],
  ['all, every voice counts', engine({ voices: 99 })],
  ['all, no spreading', engine({ repeat: 1 })],
  ['all, no veto', engine({ veto: 0 })],
  ['who loved it, anyone tied', engine({ priorStrength: 1e6, floor: 0 })],
  ['who is close, any response', engine({ endorse: { loved: 0.45, liked: 0.45, none: 0.45, mixed: 0.45, not_for_me: 0.45 }, veto: 0 })],
  ['if ties were known exactly', allKnowing],
];
const worlds: [string, Partial<WorldOptions>][] = [
  ['a town (150 people)', {}],
  ['a circle of friends (30)', { people: 30, films: 150 }],
  ['a city (400)', { people: 400, films: 800 }],
  ['feelings say nothing about enjoyment', { feelingSignal: 0 }],
  ['follows are random', { homophily: 0.05 }],
  ['follows are like-minded', { homophily: 0.95 }],
  ['few verdicts', { verdictRate: 0.25 }],
  ['newcomers answer for 4 well-known films', { starter: 4 }],
  ['newcomers answer for 8 well-known films', { starter: 8 }],
  ['newcomers answer for 4, kept private', { starter: 4, starterOpen: false }],
];
const seeds = [11, 23, 37];
const only = process.argv.find(arg => arg.startsWith('--world='))?.slice(8);
const pick = process.argv.find(arg => arg.startsWith('--only='))?.slice(7).split(',');

async function main() {
  const report: Record<string, unknown> = {
    about: 'Simulated communities with a known truth. Each strategy sees only what was readable four fifths of the way through and is judged on the first five films it offers each person. This tests mechanics and robustness, not real people.',
    columns: { reached: 'share of people offered anything', yield: 'films in the first five the person would have liked, averaged over everyone', finds: 'liked films in the first five that are not among the most written-about twentieth', personal: 'yield minus the yield of giving each person somebody else\'s list', liked: 'share of offered films the person would have liked', voices: 'different people leading the first five', crowded: 'share of places taken by the most written-about twentieth of films', range: 'share of the shelf offered to anyone' },
    worlds: {} as Record<string, unknown>,
  };
  for (const [name, options] of worlds) {
    if (only && !name.includes(only)) continue;
    const shots = seeds.map(seed => snapshot(makeWorld({ ...options, seed })));
    const run = pick ? strategies.filter(([label]) => pick.some(part => label.includes(part))) : strategies;
    const rows = Object.fromEntries(run.map(([label, strategy]) => [label, average(shots.map(shot => score(strategy, shot)))]));
    const best = shots.reduce((sum, shot) => sum + ceiling(shot), 0) / shots.length;
    (report.worlds as Record<string, unknown>)[name] = { ceiling: best, strategies: rows };
    console.log(`\n${name}   (a perfect guide: ${best.toFixed(2)} of 5)`);
    console.log('strategy'.padEnd(28) + ['reached', 'yield', 'finds', 'personal', 'liked', 'voices', 'crowded', 'range', 'empty', 'few', 'many'].map(h => h.padStart(8)).join(''));
    for (const [label] of run) {
      const s = rows[label];
      console.log(label.padEnd(28) + [s.reached, s.yield, s.finds, s.personal, s.liked, s.voices ?? NaN, s.crowded, s.range, s.byDiary.empty, s.byDiary.few, s.byDiary.many].map(v => (Number.isNaN(v) ? '-' : v.toFixed(2)).padStart(8)).join(''));
    }
  }
  if (!process.argv.includes('--dry')) await writeFile(path.resolve(__dirname, '../../../docs/discovery-lab.json'), JSON.stringify(report, (_, v) => typeof v === 'number' ? Math.round(v * 1000) / 1000 : v, 2) + '\n');
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
