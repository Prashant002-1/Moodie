import { emotionLabels } from '../../utils/display';
import { FeelingKey, orderedFeelings } from '../../utils/feelings';

/** A person's feelings as plain words, strongest first. No colour, no amounts. */
export function Feelings({ entry, limit = 3 }: { entry?: Partial<Record<FeelingKey, number | string | null>> | null; limit?: number }) {
  const words = orderedFeelings(entry).slice(0, limit).map(key => emotionLabels[key]);
  if (!words.length) return null;
  return <p className="feelings" aria-label={`Feelings: ${words.join(', ')}`}>{words.map(word => <span key={word}>{word}</span>)}</p>;
}
