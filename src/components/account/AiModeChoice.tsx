import type { AiMode } from '../../services/authService';

/** The two ways Moodie can work. The copy is the contract: keep it true to what the server enforces. */
const options: { value: AiMode; title: string; points: string[] }[] = [
  {
    value: 'off', title: 'People only',
    points: [
      'No language model reads your diary, notes or conversations.',
      'No assistant can be connected to your account.',
    ],
  },
  {
    value: 'on', title: 'People, with AI',
    points: [
      'Ask why a film reached you.',
      'Connect your own assistant to your Moodie.',
      'AI never posts, follows, recommends or replies as you.',
    ],
  },
];

export default function AiModeChoice({ value, onChange, disabled, legend }: {
  value: AiMode | null; onChange: (mode: AiMode) => void; disabled?: boolean; legend: string;
}) {
  return <fieldset disabled={disabled}>
    <legend className="sr-only">{legend}</legend>
    <div className="two-up">
      {options.map(option => <label className="option" key={option.value}>
        <input checked={value === option.value} name="ai-mode" onChange={() => onChange(option.value)} type="radio" value={option.value} />
        <span className="option__title t-title3 serif">{option.title}</span>
        <ul className="option__points">{option.points.map(point => <li key={point}>{point}</li>)}</ul>
      </label>)}
    </div>
    <p className="hint" style={{ marginTop: 'var(--m-space-3)' }}>AI features are not available yet. Recommendations from people work the same either way.</p>
  </fieldset>;
}
