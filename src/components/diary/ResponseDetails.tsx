import { Enjoyment, ResponseHighlight, enjoymentLabels, highlightLabels } from '../../types/suggestion';

export function ResponseDetails({ enjoyment, highlights = [] }: { enjoyment?: Enjoyment | null; highlights?: ResponseHighlight[] }) {
  if (!enjoyment && !highlights.length) return null;
  return <p className="meta">
    {enjoyment && <span className="secondary strong">{enjoymentLabels[enjoyment]}</span>}
    {highlights.length > 0 && <span>{highlights.map(key => highlightLabels[key]).join(', ')}</span>}
  </p>;
}

export function ResponseDetailInputs({ enjoyment, highlights, onEnjoyment, onHighlights, required = false }: {
  enjoyment: Enjoyment | null; highlights: ResponseHighlight[];
  onEnjoyment: (value: Enjoyment | null) => void; onHighlights: (value: ResponseHighlight[]) => void; required?: boolean;
}) {
  return <>
    <fieldset><legend className="legend">How was it?</legend>
      <div className="chips">{(Object.entries(enjoymentLabels) as [Enjoyment, string][]).map(([value, label]) =>
        <button className="chip" type="button" key={value} aria-pressed={enjoyment === value} onClick={() => onEnjoyment(!required && enjoyment === value ? null : value)}>{label}</button>)}</div>
    </fieldset>
    <fieldset><legend className="legend">What stood out?</legend>
      <div className="chips">{(Object.entries(highlightLabels) as [ResponseHighlight, string][]).map(([value, label]) =>
        <button className="chip" type="button" key={value} aria-pressed={highlights.includes(value)} onClick={() => onHighlights(highlights.includes(value) ? highlights.filter(key => key !== value) : [...highlights, value])}>{label}</button>)}</div>
    </fieldset>
  </>;
}
