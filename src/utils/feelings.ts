import { EmotionScores } from '../types/emotion';
import { emotionLabels } from './display';

/**
 * Feelings are words in an order, not amounts. A person picks up to three and
 * the order they pick them in is the only strength Moodie records: first is
 * strongest. The stored numbers exist so two people's words can be compared;
 * they are never shown.
 */
export type FeelingKey = keyof EmotionScores;
export const FEELING_KEYS = Object.keys(emotionLabels) as FeelingKey[];
export const MAX_FEELINGS = 3;
const ORDER_WEIGHTS = [1, 0.6, 0.3];

export const noFeelings = (): EmotionScores => ({ neutral: 0, happy: 0, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0 });

/** The words a person chose, strongest first. Accepts any record that carries the seven keys. */
export const orderedFeelings = (scores?: Partial<Record<FeelingKey, number | string | null>> | null): FeelingKey[] =>
  FEELING_KEYS.map(key => [key, Number(scores?.[key]) || 0] as const)
    .filter(([, value]) => value > 0.02)
    .sort(([, first], [, second]) => second - first)
    .map(([key]) => key);

export const feelingsFromOrder = (order: FeelingKey[]): EmotionScores => {
  const next = noFeelings();
  order.forEach((key, index) => { next[key] = ORDER_WEIGHTS[index] ?? 0.15; });
  return next;
};

export const feelingWords = (scores?: Partial<Record<FeelingKey, number | string | null>> | null) =>
  orderedFeelings(scores).map(key => emotionLabels[key]);
