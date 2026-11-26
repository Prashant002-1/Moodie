import { EmotionScores } from '../../types/emotion';
import { emotionLabels } from '../../utils/display';
import { FEELING_KEYS, FeelingKey, MAX_FEELINGS, feelingsFromOrder, orderedFeelings } from '../../utils/feelings';

/**
 * Pick up to three words. The order of picking is the only strength recorded:
 * there is no slider and no percentage.
 */
export function FeelingChoices({ value, onChange, disabled = false }: {
  value: EmotionScores; onChange: (value: EmotionScores) => void; disabled?: boolean;
}) {
  // An older response can hold more than three feelings. Its three strongest are
  // the ones shown everywhere else, so they are the ones shown as chosen here;
  // the stored values only change when the person changes their choice.
  const chosen = orderedFeelings(value).slice(0, MAX_FEELINGS);
  const full = chosen.length >= MAX_FEELINGS;
  const toggle = (key: FeelingKey) => onChange(feelingsFromOrder(chosen.includes(key) ? chosen.filter(item => item !== key) : [...chosen, key]));
  return <fieldset disabled={disabled}>
    <legend className="legend">What did you feel?</legend>
    <p className="hint" id="feelings-hint">Up to three. The first is the strongest.</p>
    <div className="chips" aria-describedby="feelings-hint">{FEELING_KEYS.map(key => {
      const position = chosen.indexOf(key);
      const selected = position >= 0;
      return <button aria-pressed={selected} className="chip" disabled={!selected && full} key={key} onClick={() => toggle(key)} type="button">
        {selected && <span aria-hidden="true" className="chip__order">{position + 1}</span>}{emotionLabels[key]}
        {selected && <span className="sr-only">, {position === 0 ? 'strongest' : position === 1 ? 'second' : 'third'}</span>}
      </button>;
    })}</div>
  </fieldset>;
}
