import { ReactNode, useState } from 'react';

export function Spoiler({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  return hidden && !revealed
    ? <div><button className="btn btn--secondary btn--small" onClick={() => setRevealed(true)} type="button">Show spoilers</button></div>
    : <>{children}</>;
}
