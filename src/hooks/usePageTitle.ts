import { useEffect } from 'react';

const SITE = 'Moodie';

/**
 * Names the page in the browser tab, in history and to a screen reader.
 * Without a title (still loading, or the front page) the tab reads "Moodie".
 */
export function usePageTitle(title?: string | null | false) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : SITE;
    if (title) window.dispatchEvent(new CustomEvent('moodie:page', { detail: title }));
    return () => { document.title = SITE; };
  }, [title]);
}
