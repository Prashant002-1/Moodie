/** Dark is Moodie's identity and the default. A person can choose light, or to follow their system. Stored per browser. */
export type ThemeChoice = 'dark' | 'light' | 'system';
const KEY = 'moodie:theme';

export const readTheme = (): ThemeChoice => {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'system' ? value : 'dark';
  } catch { return 'dark'; }
};

const tintBrowser = () => {
  const bar = getComputedStyle(document.documentElement).getPropertyValue('--m-color-sunken').trim();
  if (bar) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bar);
};
let watching = false;

export const applyTheme = (choice: ThemeChoice) => {
  document.documentElement.dataset.theme = choice;
  tintBrowser();
  // "System" follows the device as it changes between light and dark.
  if (!watching && typeof window.matchMedia === 'function') {
    watching = true;
    window.matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', tintBrowser);
  }
};

export const saveTheme = (choice: ThemeChoice) => {
  try { localStorage.setItem(KEY, choice); } catch { /* private mode: apply for this visit only */ }
  applyTheme(choice);
};
