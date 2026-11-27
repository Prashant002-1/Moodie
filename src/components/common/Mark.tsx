/**
 * Small drawings in ink for the quiet moments: an empty diary, nobody followed yet, a note on its way.
 * One stroke weight, no fill, no colour. They draw themselves once when they appear.
 */
const drawings = {
  // A ticket, a little askew: the diary and anything kept.
  ticket: <g transform="rotate(-8 32 32)">
    <path d="M8 20h48v8a4 4 0 0 0 0 8v8H8v-8a4 4 0 0 0 0-8z" pathLength={1} />
    <path className="mark__dash" d="M41 23v18" />
    <path d="M15 28h18M15 34h11" pathLength={1} />
    <path d="M49 29v6M46 32h6" pathLength={1} />
  </g>,
  // A folded note in flight: a recommendation.
  plane: <>
    <path d="M9 31 55 11 41 53 30 37z" pathLength={1} />
    <path d="M30 37 55 11" pathLength={1} />
    <path className="mark__dash" d="M7 47c6 4 12 5 18 2" />
  </>,
  // Two seats side by side: people.
  seats: <>
    <path d="M11 38V22a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v16M8 38h22v6a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2zM12 46v6M26 46v6" pathLength={1} />
    <path d="M37 38V22a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v16M34 38h22v6a2 2 0 0 1-2 2H36a2 2 0 0 1-2-2zM38 46v6M52 46v6" pathLength={1} />
  </>,
  // A reel with its film trailing off: nothing here.
  reel: <>
    <circle cx="29" cy="29" pathLength={1} r="20" />
    <circle cx="29" cy="29" pathLength={1} r="2.5" />
    <circle cx="29" cy="17" pathLength={1} r="4.5" /><circle cx="40.4" cy="25.3" pathLength={1} r="4.5" /><circle cx="36" cy="38.7" pathLength={1} r="4.5" />
    <circle cx="22" cy="38.7" pathLength={1} r="4.5" /><circle cx="17.6" cy="25.3" pathLength={1} r="4.5" />
    <path d="M29 49c11 0 19 2 28 7" pathLength={1} />
  </>,
};
export type MarkName = keyof typeof drawings;

export function Mark({ name, size = 56, className = '' }: { name: MarkName; size?: number; className?: string }) {
  return <svg aria-hidden="true" className={`mark${className ? ` ${className}` : ''}`} fill="none" height={size} stroke="currentColor"
    strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} viewBox="0 0 64 64" width={size}>{drawings[name]}</svg>;
}
