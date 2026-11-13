import { ReactNode, useState } from 'react';

export function Spoiler({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  return hidden && !revealed
    ? <button className="button button--secondary" onClick={() => setRevealed(true)}>Show spoilers</button>
    : <>{children}</>;
}
