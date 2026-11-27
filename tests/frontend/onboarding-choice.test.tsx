import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';
const mocks = vi.hoisted(() => ({ starter: vi.fn(), me: vi.fn(), preferences: vi.fn(), emailNotifications: vi.fn(), summary: vi.fn(), savedPage: vi.fn() }));
vi.mock('../../src/services/authService', () => ({ authService: { me: mocks.me, preferences: mocks.preferences, emailNotifications: mocks.emailNotifications, clear: vi.fn() } }));
vi.mock('../../src/services/pathService', () => ({ pathService: { starter: mocks.starter } }));
vi.mock('../../src/services/diaryService', () => ({ diaryService: { summary: mocks.summary, savedPage: mocks.savedPage } }));
const member = { id: 3, username: 'member', email: 'member@example.test', bio: '' };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.summary.mockResolvedValue({ entries: 0, public_entries: 0, saved: 0 });
  mocks.savedPage.mockResolvedValue({ films: [], nextOffset: null });
  mocks.starter.mockResolvedValue([{ id: 201, title: 'Well Known', release_date: null, poster_path: null }]);
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
  // Next, films they may have seen: still no product navigation, and it can be skipped.
  expect(await screen.findByRole('heading', { name: 'Seen any of these?' })).toBeInTheDocument();
  expect(mocks.preferences).toHaveBeenLastCalledWith('off');
  expect(window.location.pathname).toBe('/start');
  expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'I have seen Well Known' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('link', { name: 'Skip' }));
  expect(await screen.findByRole('heading', { name: 'Account' })).toBeInTheDocument();
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

it('offers Dark, Light and System in Account with Dark as the default, applies the choice at once and always keeps it on this browser', async () => {
  mocks.me.mockResolvedValue({ ...member, ai_mode: 'off' });
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: 'Appearance' }));
  expect(screen.getAllByRole('radio').map(radio => radio.closest('label')?.textContent)).toEqual(['Dark', 'Light', 'System']);
  // Dark is Moodie's identity: it is the choice until the person makes another.
  expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
  await userEvent.click(screen.getByRole('radio', { name: 'Light' }));
  expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked();
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  expect(localStorage.setItem).toHaveBeenLastCalledWith('moodie:theme', 'light');
  // Following the system is a stored choice too, and the page always says which theme it is in.
  await userEvent.click(screen.getByRole('radio', { name: 'System' }));
  expect(screen.getByRole('radio', { name: 'System' })).toBeChecked();
  expect(document.documentElement).toHaveAttribute('data-theme', 'system');
  expect(localStorage.setItem).toHaveBeenLastCalledWith('moodie:theme', 'system');
  await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(localStorage.setItem).toHaveBeenLastCalledWith('moodie:theme', 'dark');
  expect(localStorage.removeItem).not.toHaveBeenCalledWith('moodie:theme');
  // Signed-in pages have no footer, so the film data credit lives here.
  expect(screen.getByText('This product uses the TMDB API but is not endorsed or certified by TMDB.')).toBeInTheDocument();
});

it('shows the person their own avatar in their colour on the Account profile', async () => {
  mocks.me.mockResolvedValue({ ...member, ai_mode: 'off' });
  render(<App />);
  const name = await screen.findByText('@member');
  const who = name.closest('[data-hue]')!;
  expect(who).toHaveAttribute('data-hue', expect.stringMatching(/^[1-7]$/));
  expect(who.querySelector('.avatar--lg')).toHaveTextContent('m');
  expect(screen.getByRole('link', { name: 'Public profile' })).toHaveAttribute('href', '/member/member');
});

const emailChoice = 'Email me when someone recommends a film, replies, or a reminder comes due';
it('lets a person turn email off under Notifications, says plainly that nothing is sent yet, and keeps the saved choice when a change fails', async () => {
  mocks.me.mockResolvedValue({ ...member, ai_mode: 'off', email_notifications: true });
  mocks.emailNotifications.mockResolvedValueOnce({ ...member, ai_mode: 'off', email_notifications: false }).mockRejectedValueOnce(new Error('offline'));
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
  expect(screen.getByRole('checkbox', { name: emailChoice })).toBeChecked();
  expect(screen.getByText('Moodie is not sending emails yet. Your choice is kept for when it does.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('checkbox', { name: emailChoice }));
  expect(await screen.findByRole('status')).toHaveTextContent('Email notifications are off.');
  expect(mocks.emailNotifications).toHaveBeenLastCalledWith(false);
  expect(screen.getByRole('checkbox', { name: emailChoice })).not.toBeChecked();
  // The AI choice goes through its own call and is not restated.
  expect(mocks.preferences).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('checkbox', { name: emailChoice }));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(mocks.emailNotifications).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole('checkbox', { name: emailChoice })).not.toBeChecked();
});

it('opens Account on Notifications from the link in an email, and reads an older server without the field as on', async () => {
  window.history.replaceState({}, '', '/account?view=notifications');
  mocks.me.mockResolvedValue({ ...member, ai_mode: 'off' });
  render(<App />);
  expect(await screen.findByRole('checkbox', { name: emailChoice })).toBeChecked();
  expect(screen.getByRole('button', { name: 'Notifications' })).toHaveAttribute('aria-pressed', 'true');
});
