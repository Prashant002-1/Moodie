/** Dark is Moodie's identity and the default. A person can choose light, or to follow their system. Stored per browser. */
export type ThemeChoice = 'dark' | 'light' | 'system';
const KEY = 'moodie:theme';

export const readTheme = (): ThemeChoice => {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'system' ? value : 'dark';
  } catch { return 'dark'; }
};

export const applyTheme = (choice: ThemeChoice) => { document.documentElement.dataset.theme = choice; };

export const saveTheme = (choice: ThemeChoice) => {
  try { localStorage.setItem(KEY, choice); } catch { /* private mode: apply for this visit only */ }
  applyTheme(choice);
};
