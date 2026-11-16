import { EmotionScores } from '../../types/emotion';
import { Feelings } from '../response/Feelings';

/** Kept under its old name for existing imports. Feelings are shown as words only. */
export function ResponseFeelingTrace({ entry }: { entry: EmotionScores }) {
  return <Feelings entry={entry} />;
}
