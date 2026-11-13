import { LearningResponse, EMOTION_KEYS, clamp, aggregatePathLoss, expectedLoss, mse, predictTransfer, SharedResponse, TransferModel, baselineErrors, evaluateTransfer, makeTransferExamples, trainTransferModel } from '../services/emotionalLearning';

/** Controlled, reproducible data only. This is not a substitute for member data.
 * Film affect, viewer intensity/style, viewing selection and noise vary separately.
 * The generator never calls the learner or its feature construction. */
export function simulatedResponses(seed = 17, randomFeelings = false): LearningResponse[] {
  let state = seed;
  const random = () => { state = Math.imul(1664525, state) + 1013904223 | 0; return (state >>> 0) / 4294967296; };
  const films = Array.from({ length: 64 }, () => EMOTION_KEYS.map(() => random()));
  const viewers = Array.from({ length: 20 }, () => ({ offset: EMOTION_KEYS.map(() => (random() - .5) * .36), gain: .5 + random() * .9 }));
  const result: LearningResponse[] = [];
  for (let film = 0; film < films.length; film++) {
    const order = viewers.map((v, userId) => ({ v, userId, order: random() })).sort((a, b) => a.order - b.order);
    for (const { v, userId } of order) {
      if (random() < .3) continue;
      const at = Math.round(film * 100000 + random() * 750000);
      result.push({ id: result.length + 1, userId: userId + 1, movieId: film + 1, availableAt: at, watchedAt: at,
        values: films[film].map((x, d) => randomFeelings ? random() : clamp(x * v.gain + v.offset[d] + (random() - .5) * .08)) });
    }
  }
  return result.sort((a, b) => a.availableAt - b.availableAt || a.id - b.id);
}

/** Global-time split, not a per-person last-row split. All model fitting and
 * hyperparameter selection precede every test target. Earlier test responses
 * can supply a later target's history, as they would in the running product. */
export function benchmark(responses: LearningResponse[]) {
  const times = [...new Set(responses.map(r => r.availableAt))].sort((a, b) => a - b);
  const cutoff = times[Math.floor(times.length * .8)] ?? 0;
  const before = responses.filter(r => r.availableAt < cutoff);
  const test = makeTransferExamples(responses).filter(e => e.at >= cutoff);
  const started = performance.now();
  const model = trainTransferModel(before);
  const elapsed = performance.now() - started;
  const metrics = evaluateTransfer(model, test);
  return { responses: responses.length, publicPeople: new Set(responses.map(r => r.userId)).size,
    cutoff, trainingResponses: before.length, testTargets: new Set(test.map(e => e.targetId)).size,
    testPaths: test.length, model: { status: model.status, targets: model.targets, lambda: model.lambda, validation: model.validation },
    test: test.length ? { baselines: baselineErrors(before, test), sourceCopyMse: metrics.baselineMse, transferMse: metrics.modelMse, transferMae: metrics.mae,
      relativeMseReduction: metrics.baselineMse ? 1 - metrics.modelMse / metrics.baselineMse : 0 } : null,
    intentRanking: rankIntentAtCutoff(model, responses, cutoff),
    trainMilliseconds: Math.round(elapsed) };
}

// Only movies whose public source was available at the cutoff enter ranking.
// Future self-reports are relevance labels, never features. Unobserved films
// are not fabricated negatives. Thus this measures intent fit on known labels,
// not click-through, satisfaction, or next-watch recall.
function rankIntentAtCutoff(model: TransferModel, responses: LearningResponse[], cutoff: number) {
  const histories = new Map<number, Map<number, LearningResponse>>();
  const truth = new Map<number, Map<number, LearningResponse>>();
  for (const r of [...responses].sort((a, b) => a.availableAt - b.availableAt || a.id - b.id)) {
    const collection = r.availableAt < cutoff ? histories : truth;
    const history = collection.get(r.userId) || new Map<number, LearningResponse>();
    if (!history.has(r.movieId) || r.availableAt < cutoff) history.set(r.movieId, r);
    collection.set(r.userId, history);
  }
  let queries = 0, transferRegret = 0, sourceRegret = 0, transferHits = 0, sourceHits = 0;
  for (const [viewerId, future] of truth) {
    const viewer = histories.get(viewerId);
    if (!viewer) continue;
    for (let dimension = 0; dimension < 7; dimension++) {
      const intent = EMOTION_KEYS.map((_, d) => d === dimension ? 1 : 0);
      const candidates: { id: number; truth: number; transfer: number; source: number }[] = [];
      for (const [movie, outcome] of future) {
        if (viewer.has(movie)) continue;
        const losses: { loss: number; variance: number }[] = [], sourceLosses: { loss: number; variance: number }[] = [];
        for (const [personId, person] of histories) {
          const source = person.get(movie);
          if (personId === viewerId || !source || source.values[dimension] < .06) continue;
          const shared: SharedResponse[] = [];
          for (const [id, v] of viewer) {
            const p = person.get(id);
            if (p) shared.push({ viewer: v, person: p });
          }
          if (!shared.some(p => p.viewer.values.some((v, d) => Math.min(v, p.person.values[d]) >= .06))) continue;
          const prediction = predictTransfer(model, shared, source.values);
          const variance = prediction.variance.reduce((s, v) => s + v, 0) / 7;
          losses.push({ loss: expectedLoss(prediction, intent), variance });
          sourceLosses.push({ loss: expectedLoss({ values: source.values, variance: prediction.variance }, intent), variance });
        }
        if (losses.length) candidates.push({ id: movie, truth: mse(outcome.values, intent),
          transfer: aggregatePathLoss(losses), source: aggregatePathLoss(sourceLosses) });
      }
      if (candidates.length < 3) continue;
      const best = [...candidates].sort((a, b) => a.truth - b.truth || a.id - b.id)[0];
      const predicted = [...candidates].sort((a, b) => a.transfer - b.transfer || a.id - b.id)[0];
      const source = [...candidates].sort((a, b) => a.source - b.source || a.id - b.id)[0];
      queries++; transferRegret += predicted.truth - best.truth; sourceRegret += source.truth - best.truth;
      transferHits += Number(predicted.id === best.id); sourceHits += Number(source.id === best.id);
    }
  }
  return queries ? { queries, transferRegretAt1: transferRegret / queries, sourceRegretAt1: sourceRegret / queries,
    transferTop1Agreement: transferHits / queries, sourceTop1Agreement: sourceHits / queries } : null;
}
