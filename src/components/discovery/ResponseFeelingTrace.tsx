import { EmotionScores } from '../../types/emotion';
import { emotionColors, emotionLabels } from '../../utils/display';

const feelingKeys = Object.keys(emotionLabels) as (keyof EmotionScores)[];

function responseFeelings(entry: EmotionScores) {
  return feelingKeys
    .map(key => ({ key, label: emotionLabels[key], value: Number(entry[key]) || 0 }))
    .filter(feeling => feeling.value > 0.02)
    .sort((first, second) => second.value - first.value);
}

export function ResponseFeelingTrace({ entry }: { entry: EmotionScores }) {
  const feelings = responseFeelings(entry);
  if (!feelings.length) return null;

  return (
    <div className="feed-response__feelings" aria-label={`Feelings: ${feelings.map(feeling => feeling.label).join(', ')}`} role="img">
      <span aria-hidden="true" className="feed-response__trace">
        {feelings.map(feeling => <i key={feeling.key} style={{ backgroundColor: emotionColors[feeling.key], flexGrow: Math.max(feeling.value, 0.03) }} />)}
      </span>
      <span>{feelings.slice(0, 4).map(feeling => feeling.label).join(' · ')}</span>
    </div>
  );
}
