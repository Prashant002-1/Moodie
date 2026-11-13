import type { AiMode } from '../../services/authService';
import './AiModeChoice.css';

/** The two ways Moodie can work. The copy is the contract: keep it true to what the server enforces. */
const options: { value: AiMode; numeral: string; title: string; summary: string; points: string[]; footnote?: string }[] = [
  {
    value: 'off', numeral: 'I', title: 'People only',
    summary: 'Films reach you through people, and nothing else.',
    points: [
      'Recommendations come from people you follow and people who felt the way you did about the same films.',
      'No language model reads your diary, your notes or your conversations.',
      'No assistant can be connected to your account.',
    ],
  },
  {
    value: 'on', numeral: 'II', title: 'People, with AI',
    summary: 'Everything in People only, with AI available when you ask for it.',
    points: [
      'Ask why a film reached you and get a plain answer built from responses you could already read.',
      'Connect your own assistant to your Moodie, with your permission and nobody else’s private writing.',
      'AI never posts, follows, recommends or replies in your name.',
    ],
    footnote: 'These features arrive in a later release. Your choice is saved now and applies from the moment they do.',
  },
];

export default function AiModeChoice({ value, onChange, disabled, legend }: {
  value: AiMode | null; onChange: (mode: AiMode) => void; disabled?: boolean; legend: string;
}) {
  return <fieldset className="ai-choice" disabled={disabled}>
    <legend className="ai-choice__legend">{legend}</legend>
    <div className="ai-choice__options">
      {options.map(option => <label className="ai-choice__option" data-selected={value === option.value} key={option.value}>
        <input checked={value === option.value} name="ai-mode" onChange={() => onChange(option.value)} type="radio" value={option.value} />
        <span aria-hidden="true" className="ai-choice__numeral">{option.numeral}</span>
        <span className="ai-choice__title">{option.title}</span>
        <span className="ai-choice__summary">{option.summary}</span>
        <ul>{option.points.map(point => <li key={point}>{point}</li>)}</ul>
        {option.footnote && <span className="ai-choice__footnote">{option.footnote}</span>}
      </label>)}
    </div>
  </fieldset>;
}
