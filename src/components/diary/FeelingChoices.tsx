import { useId } from 'react';
import { EmotionScores } from '../../types/emotion';
import { emotionColors, emotionLabels } from '../../utils/display';
import './Composer.css';

export function FeelingChoices({ value, onChange, disabled = false }: {
  value: EmotionScores; onChange: (value: EmotionScores) => void; disabled?: boolean;
}) {
  const id = useId();
  const keys = Object.keys(emotionLabels) as (keyof EmotionScores)[];
  const selected = keys.filter(key => value[key] > 0);
  return <fieldset className="feeling-choices" disabled={disabled}>
    <legend>What did you feel?</legend>
    <div className="response-choices">{keys.map(key => <button key={key} type="button" aria-pressed={value[key] > 0}
      style={{ '--feeling-color': emotionColors[key] } as React.CSSProperties}
      onClick={() => onChange({ ...value, [key]: value[key] > 0 ? 0 : .5 })}>
      <i aria-hidden="true" />{emotionLabels[key]}
    </button>)}</div>
    {selected.length > 0 ? <details><summary>Adjust intensity</summary>
      {selected.map(key => <div className="slider-row" key={key}>
        <label htmlFor={`${id}-${key}`}>{emotionLabels[key]}</label>
        <input id={`${id}-${key}`} aria-label={`${emotionLabels[key]} intensity`} type="range" min="0.05" max="1" step="0.05"
          value={value[key]} onChange={event => onChange({ ...value, [key]: Number(event.target.value) })} />
        <output htmlFor={`${id}-${key}`}>{Math.round(value[key] * 100)}%</output>
      </div>)}
    </details> : <p className="metadata">Choose the feelings that stayed.</p>}
  </fieldset>;
}
