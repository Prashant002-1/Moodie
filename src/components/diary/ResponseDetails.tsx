import { Enjoyment, ResponseHighlight, enjoymentLabels, highlightLabels } from '../../types/suggestion';

export function ResponseDetails({ enjoyment, highlights = [] }: { enjoyment?: Enjoyment | null; highlights?: ResponseHighlight[] }) {
  if (!enjoyment && !highlights.length) return null;
  return <div className="response-details">
    {enjoyment && <strong>{enjoymentLabels[enjoyment]}</strong>}
    {highlights.length > 0 && <span>{highlights.map(key => highlightLabels[key]).join(' · ')}</span>}
  </div>;
}

export function ResponseDetailInputs({ enjoyment, highlights, onEnjoyment, onHighlights, required = false }: {
  enjoyment: Enjoyment | null; highlights: ResponseHighlight[];
  onEnjoyment: (value: Enjoyment | null) => void; onHighlights: (value: ResponseHighlight[]) => void; required?: boolean;
}) {
  return <div className="response-detail-inputs">
    <fieldset><legend>Did you enjoy it?{!required && <small> Optional</small>}</legend>
      <div className="response-choices">{(Object.entries(enjoymentLabels) as [Enjoyment, string][]).map(([value, label]) =>
        <button type="button" key={value} aria-pressed={enjoyment === value} onClick={() => onEnjoyment(!required && enjoyment === value ? null : value)}>{label}</button>)}</div>
    </fieldset>
    <details><summary>What stayed with you?{highlights.length > 0 && ` (${highlights.length})`}</summary>
      <div className="response-choices">{(Object.entries(highlightLabels) as [ResponseHighlight, string][]).map(([value, label]) =>
        <button type="button" key={value} aria-pressed={highlights.includes(value)} onClick={() => onHighlights(highlights.includes(value) ? highlights.filter(key => key !== value) : [...highlights, value])}>{label}</button>)}</div>
    </details>
  </div>;
}
