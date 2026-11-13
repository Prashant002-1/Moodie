/** Appearance follows the system unless the person picks a theme. Stored per browser. */
export type ThemeChoice = 'system' | 'light' | 'dark';
const KEY = 'moodie:theme';

export const readTheme = (): ThemeChoice => {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch { return 'system'; }
};

export const applyTheme = (choice: ThemeChoice) => {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme'); else root.dataset.theme = choice;
};

export const saveTheme = (choice: ThemeChoice) => {
  try { if (choice === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, choice); } catch { /* private mode: apply for this visit only */ }
  applyTheme(choice);
};
