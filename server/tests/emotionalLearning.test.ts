import { describe, expect, it } from '@jest/globals';
import { simulatedResponses, benchmark } from '../src/evaluation/responseBenchmark';
import { baselineErrors, evaluateTransfer, makeTransferExamples, trainTransferModel, transferFeatures } from '../src/services/emotionalLearning';

describe('learned cross-film response transfer', () => {
  it('preserves absolute intensity and mixed feelings', () => {
    const [a, b] = simulatedResponses().slice(0, 2);
    const intense = { ...a, values: [0, .9, .1, 0, 0, 0, 0] };
    const quiet = { ...b, values: [0, .45, .05, 0, 0, 0, 0] };
    expect(transferFeatures([{ viewer: intense, person: quiet }], quiet.values)).not.toEqual(
      transferFeatures([{ viewer: intense, person: intense }], quiet.values));
  });

  it('learns coefficients and generalizes beyond an intensity-offset heuristic across later films', () => {
    for (const seed of [17, 29, 43]) {
      const report = benchmark(simulatedResponses(seed));
      expect(report.model.status).toBe('learning');
      expect(report.testTargets).toBeGreaterThan(100);
      expect(report.test!.transferMse).toBeLessThan(report.test!.baselines.sharedFilmOffset);
      expect(report.test!.transferMse).toBeLessThan(report.test!.baselines.populationMean);
      expect(report.test!.relativeMseReduction).toBeGreaterThan(.5);
      expect(report.intentRanking!.queries).toBeGreaterThan(20);
      expect(report.intentRanking!.transferRegretAt1).toBeLessThan(report.intentRanking!.sourceRegretAt1);
    }
  });

  it('never leaks a target film, future publication, or equal-time publication into its features', () => {
    const responses = simulatedResponses(17);
    const byId = new Map(responses.map(r => [r.id, r]));
    for (const e of makeTransferExamples(responses)) {
      const target = byId.get(e.targetId)!;
      expect(byId.get(e.sourceId)!.availableAt).toBeLessThan(target.availableAt);
      expect(byId.get(e.sourceId)!.movieId).toBe(target.movieId);
      for (const id of e.historyIds) {
        expect(byId.get(id)!.availableAt).toBeLessThan(target.availableAt);
        expect(byId.get(id)!.movieId).not.toBe(target.movieId);
      }
    }
    expect(makeTransferExamples(responses.map(r => ({ ...r, availableAt: 1 })))).toEqual([]);
  });

  it('has a deterministic learner and refuses to present sparse data as trained evidence', () => {
    const rows = simulatedResponses(29);
    expect(trainTransferModel(rows.slice(0, 10)).status).toBe('collecting');
    expect(trainTransferModel(rows)).toEqual(trainTransferModel([...rows].reverse()));
    expect(trainTransferModel(rows).coefficients.flat().some(x => Math.abs(x) > .01)).toBe(true);
  });

  it('does not report a shared-signal discovery when a population average is better on unrelated feelings', () => {
    const rows = simulatedResponses(211, true);
    const before = rows.slice(0, Math.floor(rows.length * .8));
    const model = trainTransferModel(before);
    expect(model.status).toBe('collecting');
    expect(model.validation?.bestBaseline).toBe('populationMean');
    const test = makeTransferExamples(rows).filter(e => e.at > before[before.length - 1].availableAt);
    expect(baselineErrors(before, test).populationMean).toBeLessThan(evaluateTransfer(model, test).modelMse);
  });
});
