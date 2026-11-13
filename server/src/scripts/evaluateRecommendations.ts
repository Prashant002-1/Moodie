import { PGlite } from '@electric-sql/pglite';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { benchmark, simulatedResponses } from '../evaluation/responseBenchmark';
import { EmotionScores, vector } from '../services/emotionalLearning';

async function main() {
  const root = path.resolve(__dirname, '../../..');
  const snapshot = await readFile(path.join(root, 'database/demo-seed.tgz'));
  const db = await PGlite.create({ dataDir: 'memory://', loadDataDir: new Blob([new Uint8Array(snapshot)]) });
  try {
    const data = await db.query(`SELECT * FROM diary_entries WHERE visibility = 'public' AND trim(note) <> '' ORDER BY id`);
    const demo = data.rows.map(raw => {
      const r = raw as EmotionScores & { id: number; user_id: number; movie_id: number; created_at: string; updated_at: string; watched_on: string };
      return { id: Number(r.id), userId: Number(r.user_id), movieId: Number(r.movie_id), values: vector(r),
        availableAt: Math.max(new Date(r.created_at).getTime(), new Date(r.updated_at).getTime()), watchedAt: new Date(r.watched_on).getTime() };
    }).filter(r => r.values.some(v => v > 0));
    const report = { version: 'response-transfer-v1', evaluation: 'Global temporal holdout. Validation and test targets are disjoint.',
      limitations: [
        'The bundled snapshot is scripted demonstration data. The generated cohorts are controlled simulations.',
        'These results test learnability and implementation, not real-world recommendation quality or research novelty.',
        'The target is a person\'s later self-reported feeling vector, not enjoyment, a rating, or a probability of watching.',
        'The benchmark has no external data, services, or private account records.',
      ],
      bundledDemo: benchmark(demo),
      controlled: [17, 29, 43, 67, 101].map(seed => ({ seed, ...benchmark(simulatedResponses(seed)) })),
      unrelatedFeelings: benchmark(simulatedResponses(211, true)),
    };
    const destination = path.join(root, 'docs/recommendation-evaluation.json');
    await writeFile(destination, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally { await db.close(); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
