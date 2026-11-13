import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';
const mocks = vi.hoisted(() => ({ me: vi.fn(), preferences: vi.fn(), summary: vi.fn(), savedPage: vi.fn() }));
vi.mock('../../src/services/authService', () => ({ authService: { me: mocks.me, preferences: mocks.preferences, clear: vi.fn() } }));
vi.mock('../../src/services/diaryService', () => ({ diaryService: { summary: mocks.summary, savedPage: mocks.savedPage } }));
const member = { id: 3, username: 'member', email: 'member@example.test', bio: '' };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.summary.mockResolvedValue({ entries: 0, public_entries: 0, saved: 0 });
  mocks.savedPage.mockResolvedValue({ films: [], nextOffset: null });
  window.history.replaceState({}, '', '/account');
});
afterEach(() => { window.history.replaceState({}, '', '/'); });

it('asks a new account how Moodie should work before showing anything else, keeps the choice on failure, then returns', async () => {
  mocks.me.mockResolvedValue({ ...member, ai_mode: null });
  mocks.preferences.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ...member, ai_mode: 'off' });
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'With or without AI?' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/welcome');
  // Onboarding is one decision: no product navigation competes with it.
  expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument();
  const proceed = screen.getByRole('button', { name: 'Continue' });
  expect(proceed).toBeDisabled();
  await userEvent.click(screen.getByRole('radio', { name: /^People only/ }));
  await userEvent.click(proceed);
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved');
  expect(screen.getByRole('radio', { name: /^People only/ })).toBeChecked();
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByRole('heading', { name: 'Account' })).toBeInTheDocument();
  expect(mocks.preferences).toHaveBeenLastCalledWith('off');
  expect(window.location.pathname).toBe('/account');
});

it('does not ask again once chosen, and never traps a person when an older server omits the field', async () => {
  for (const user of [{ ...member, ai_mode: 'on' }, member]) {
    mocks.me.mockResolvedValue(user);
    window.history.replaceState({}, '', '/account');
    const view = render(<App />);
    expect(await screen.findByRole('heading', { name: 'Account' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/account');
    view.unmount();
  }
});

it('lets a person change the choice from Account', async () => {
  mocks.me.mockResolvedValue({ ...member, ai_mode: 'off' });
  mocks.preferences.mockResolvedValue({ ...member, ai_mode: 'on' });
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: 'AI' }));
  expect(screen.getByRole('radio', { name: /^People only/ })).toBeChecked();
  await userEvent.click(screen.getByRole('radio', { name: /^People, with AI/ }));
  expect(await screen.findByRole('status')).toHaveTextContent('AI is on for your account.');
  expect(mocks.preferences).toHaveBeenCalledWith('on');
  expect(screen.getByRole('radio', { name: /^People, with AI/ })).toBeChecked();
});

it('offers System, Light and Dark in Account, applies the choice at once and keeps it on this browser', async () => {
  mocks.me.mockResolvedValue({ ...member, ai_mode: 'off' });
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: 'Appearance' }));
  expect(screen.getAllByRole('radio').map(radio => radio.closest('label')?.textContent)).toEqual(['System', 'Light', 'Dark']);
  expect(screen.getByRole('radio', { name: 'System' })).toBeChecked();
  await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
  expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(localStorage.setItem).toHaveBeenCalledWith('moodie:theme', 'dark');
  await userEvent.click(screen.getByRole('radio', { name: 'System' }));
  expect(document.documentElement).not.toHaveAttribute('data-theme');
  expect(localStorage.removeItem).toHaveBeenCalledWith('moodie:theme');
  // Signed-in pages have no footer, so the film data credit lives here.
  expect(screen.getByText('This product uses the TMDB API but is not endorsed or certified by TMDB.')).toBeInTheDocument();
});

