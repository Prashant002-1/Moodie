/**
 * Cross-film response transfer. No film/user IDs, notes, ratings or metadata are
 * features. Targets are later, self-reported feelings, never invented likes.
 * All timestamps here mean when the current version became available.
 */
export const EMOTION_KEYS = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'] as const;
export type EmotionKey = typeof EMOTION_KEYS[number];
export type EmotionScores = Record<EmotionKey, number>;
export const clamp = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
export const vector = (r: Partial<EmotionScores>) => EMOTION_KEYS.map(k => clamp(Number(r[k]) || 0));
export const mse = (a: number[], b: number[]) => a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0) / a.length;
const mean = (rows: number[][]) => Array.from({ length: 7 }, (_, d) => rows.reduce((s, r) => s + r[d], 0) / Math.max(1, rows.length));

export interface LearningResponse {
  id: number;
  userId: number;
  movieId: number;
  values: number[];
  availableAt: number;
  watchedAt: number;
}
export interface SharedResponse { viewer: LearningResponse; person: LearningResponse }
export interface TransferExample {
  targetId: number;
  at: number;
  source: number[];
  target: number[];
  features: number[];
  weight: number;
  // Auditable training lineage; not part of the feature vector.
  sourceId: number;
  historyIds: number[];
}

export const transferFeatures = (shared: SharedResponse[], source: number[]): number[] => {
  const delta = mean(shared.map(s => s.viewer.values.map((v, d) => v - s.person.values[d])));
  const abs = mean(shared.map(s => s.viewer.values.map((v, d) => Math.abs(v - s.person.values[d]))));
  const variance = mean(shared.map(s => s.viewer.values.map((v, d) => (v - s.person.values[d] - delta[d]) ** 2)));
  return [1, ...delta, ...abs, ...source, ...source.map((v, d) => v * delta[d]), 1 / (1 + shared.length), ...variance];
};

const newer = (a: LearningResponse, b?: LearningResponse) => !b || a.watchedAt > b.watchedAt
  || (a.watchedAt === b.watchedAt && (a.availableAt > b.availableAt || (a.availableAt === b.availableAt && a.id > b.id)));

/** Strictly historical examples. A target film is absent from BOTH histories;
 * a source must already have published it. Equal-time events cannot predict
 * each other. Rewatches stay observations, not independent shared films. */
export function makeTransferExamples(responses: LearningResponse[]): TransferExample[] {
  const sorted = [...responses].sort((a, b) => a.availableAt - b.availableAt || a.id - b.id);
  const histories = new Map<number, Map<number, LearningResponse>>();
  const filmPeople = new Map<number, Map<number, LearningResponse>>();
  const examples: TransferExample[] = [];
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (end < sorted.length && sorted[end].availableAt === sorted[start].availableAt) end++;
    for (const target of sorted.slice(start, end)) {
      const viewer = histories.get(target.userId);
      if (!viewer?.size || viewer.has(target.movieId)) continue; // predict first viewings
      const paths: TransferExample[] = [];
      for (const source of filmPeople.get(target.movieId)?.values() || []) {
        if (source.userId === target.userId) continue;
        const peer = histories.get(source.userId)!;
        const shared: SharedResponse[] = [];
        for (const [movie, v] of viewer) {
          const p = peer.get(movie);
          if (movie !== target.movieId && p) shared.push({ viewer: v, person: p });
        }
        if (!shared.length) continue;
        paths.push({ targetId: target.id, at: target.availableAt, source: source.values,
          target: target.values, features: transferFeatures(shared, source.values), weight: 1,
          sourceId: source.id, historyIds: shared.flatMap(s => [s.viewer.id, s.person.id]) });
      }
      // Each viewing, rather than each popular-film peer, has equal influence.
      paths.forEach(p => { p.weight = 1 / paths.length; examples.push(p); });
    }
    for (const r of sorted.slice(start, end)) {
      const history = histories.get(r.userId) || new Map<number, LearningResponse>();
      if (newer(r, history.get(r.movieId))) {
        history.set(r.movieId, r);
        const people = filmPeople.get(r.movieId) || new Map<number, LearningResponse>();
        people.set(r.userId, r); filmPeople.set(r.movieId, people);
      }
      histories.set(r.userId, history);
    }
    start = end;
  }
  return examples;
}

const dimension = 37;
const zeros = (n: number, m: number) => Array.from({ length: n }, () => Array(m).fill(0) as number[]);
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

/** Cholesky solve for symmetric positive definite regularized normal equations. */
function factor(a: number[][]): number[][] {
  const l = zeros(a.length, a.length);
  for (let i = 0; i < a.length; i++) for (let j = 0; j <= i; j++) {
    let s = a[i][j];
    for (let k = 0; k < j; k++) s -= l[i][k] * l[j][k];
    l[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / l[j][j];
  }
  return l;
}
function solve(l: number[][], b: number[]): number[] {
  const y = Array(b.length).fill(0), x = Array(b.length).fill(0);
  for (let i = 0; i < b.length; i++) {
    y[i] = (b[i] - l[i].slice(0, i).reduce((s, v, j) => s + v * y[j], 0)) / l[i][i];
  }
  for (let i = b.length - 1; i >= 0; i--) {
    let s = y[i];
    for (let j = i + 1; j < b.length; j++) s -= l[j][i] * x[j];
    x[i] = s / l[i][i];
  }
  return x;
}

export interface TransferModel {
  version: 'response-transfer-v1';
  status: 'learning' | 'collecting';
  examples: number;
  targets: number;
  lambda: number | null;
  coefficients: number[][];
  cholesky: number[][] | null;
  noise: number[];
  validation: { targets: number; baselineMse: number; modelMse: number; bestBaseline: string; baselines: Record<string, number> } | null;
}

function fit(examples: TransferExample[], lambda: number) {
  const a = zeros(dimension, dimension), b = zeros(7, dimension);
  for (let i = 0; i < dimension; i++) a[i][i] = lambda;
  for (const e of examples) for (let i = 0; i < dimension; i++) {
    for (let j = 0; j <= i; j++) a[i][j] += e.weight * e.features[i] * e.features[j];
    for (let d = 0; d < 7; d++) b[d][i] += e.weight * e.features[i] * (e.target[d] - e.source[d]);
  }
  for (let i = 0; i < dimension; i++) for (let j = 0; j < i; j++) a[j][i] = a[i][j];
  const cholesky = factor(a);
  return { coefficients: b.map(row => solve(cholesky, row)), cholesky };
}
const estimate = (coefficients: number[][], e: Pick<TransferExample, 'source' | 'features'>) => e.source.map((v, d) => clamp(v + dot(coefficients[d], e.features)));
export function evaluateTransfer(model: Pick<TransferModel, 'coefficients'>, examples: TransferExample[]) {
  const weight = examples.reduce((s, e) => s + e.weight, 0) || 1;
  const noise = Array(7).fill(0) as number[];
  let baseline = 0, error = 0, absolute = 0;
  for (const e of examples) {
    const p = estimate(model.coefficients, e);
    baseline += e.weight * mse(e.source, e.target);
    error += e.weight * mse(p, e.target);
    absolute += e.weight * p.reduce((s, v, d) => s + Math.abs(v - e.target[d]), 0) / 7;
    for (let d = 0; d < 7; d++) noise[d] += e.weight * (p[d] - e.target[d]) ** 2;
  }
  return { baselineMse: baseline / weight, modelMse: error / weight, mae: absolute / weight,
    noise: noise.map(x => Math.max(0.0001, x / weight)) };
}

/** Model selection uses earlier data and later validation targets. A public
 * corpus with inadequate support, or no gain over copying the source, retains
 * the transparent source prior. A separate, untouched test period is required
 * for reported quality. Hyperparameters are regularization, not ranking weights. */
export function trainTransferModel(responses: LearningResponse[]): TransferModel {
  responses = [...responses].sort((a, b) => a.availableAt - b.availableAt || a.id - b.id);
  const examples = makeTransferExamples(responses);
  const targets = new Set(examples.map(e => e.targetId)).size;
  const prior: TransferModel = { version: 'response-transfer-v1', status: 'collecting', examples: examples.length,
    targets, lambda: null, coefficients: zeros(7, dimension), cholesky: null,
    noise: Array(7).fill(1 / 12), validation: null }; // bounded uniform intensity prior
  if (targets < 30) return prior;
  const times = [...new Set(examples.map(e => e.at))].sort((a, b) => a - b);
  const cutoff = times[Math.floor(times.length * 0.8)];
  const train = examples.filter(e => e.at < cutoff), validation = examples.filter(e => e.at >= cutoff);
  const trainTargets = new Set(train.map(e => e.targetId)).size;
  const validationTargets = new Set(validation.map(e => e.targetId)).size;
  if (trainTargets < 20 || validationTargets < 10) return prior;
  const baselines = baselineErrors(responses.filter(r => r.availableAt < cutoff), validation);
  const baseline = evaluateTransfer(prior, validation);
  const bestBaseline = Object.keys(baselines).sort((a, b) => baselines[a] - baselines[b])[0];
  let best = { loss: baselines[bestBaseline], lambda: null as number | null, noise: baseline.noise };
  for (const lambda of [0.1, 1, 10, 100]) {
    const candidate = fit(train, lambda), metrics = evaluateTransfer(candidate, validation);
    if (metrics.modelMse < best.loss) best = { loss: metrics.modelMse, lambda, noise: metrics.noise };
  }
  const summary = { targets: validationTargets, baselineMse: baselines[bestBaseline], modelMse: best.loss, bestBaseline, baselines };
  if (best.lambda === null) return { ...prior, noise: baseline.noise, validation: { ...summary, modelMse: baseline.modelMse } };
  return { ...prior, ...fit(examples, best.lambda), status: 'learning', lambda: best.lambda,
    noise: best.noise, validation: summary };
}

export function predictTransfer(model: TransferModel, shared: SharedResponse[], source: number[]) {
  const features = transferFeatures(shared, source);
  const values = estimate(model.coefficients, { source, features });
  const leverage = model.cholesky ? Math.max(0, dot(features, solve(model.cholesky, features))) : 0;
  // Measurement disagreement and finite-history uncertainty are in the same
  // squared-intensity units as prediction error, not blended score percentages.
  const variance = model.noise.map((noise, d) => {
    const discrepancy = shared.reduce((s, p) => s + (p.viewer.values[d] - p.person.values[d]) ** 2, 0);
    return noise * (1 + leverage) + (noise + discrepancy) / (shared.length + 1);
  });
  return { values, variance };
}

export function expectedLoss(prediction: ReturnType<typeof predictTransfer>, target: number[]) {
  return mse(prediction.values, target) + prediction.variance.reduce((s, x) => s + x, 0) / 7;
}

/** Ablations use only pre-cutoff values. Offset corrects a peer using earlier
 * shared-film intensity differences; population mean ignores the person. */
export function baselineErrors(training: LearningResponse[], examples: TransferExample[]) {
  const population = mean(training.map(r => r.values));
  const weight = examples.reduce((s, e) => s + e.weight, 0) || 1;
  const errors: Record<string, number> = { sourceCopy: 0, sharedFilmOffset: 0, populationMean: 0 };
  for (const e of examples) {
    errors.sourceCopy += e.weight * mse(e.source, e.target);
    errors.sharedFilmOffset += e.weight * mse(e.source.map((v, d) => clamp(v + e.features[1 + d])), e.target);
    errors.populationMean += e.weight * mse(population, e.target);
  }
  return Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v / weight]));
}

/** Mixture of complete source paths, without an endorsement-count bonus. */
export const aggregatePathLoss = (paths: { loss: number; variance: number }[]) => {
  const precision = paths.reduce((s, path) => s + 1 / Math.max(path.variance, 1e-6), 0);
  return paths.reduce((s, path) => s + path.loss / Math.max(path.variance, 1e-6), 0) / precision;
};
