import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';
import { responseDraftStore } from '../../src/services/responseDraftStore';
import { newResponseDraft } from '../../src/types/responseDraft';
const mocks = vi.hoisted(() => ({ me: vi.fn(), deleteAccount: vi.fn(), summary: vi.fn(), savedPage: vi.fn() }));
vi.mock('../../src/services/authService', () => ({ authService: { me: mocks.me, deleteAccount: mocks.deleteAccount, clear: vi.fn() } }));
vi.mock('../../src/services/diaryService', () => ({ diaryService: { summary: mocks.summary, savedPage: mocks.savedPage } }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.me.mockResolvedValue({ id: 3, username: 'member', email: 'member@example.test', bio: '' });
  mocks.summary.mockResolvedValue({ entries: 1, public_entries: 0, saved: 0 });
  mocks.savedPage.mockResolvedValue({ films: [], nextOffset: null });
  window.history.replaceState({}, '', '/account');
});
afterEach(() => { vi.restoreAllMocks(); window.history.replaceState({}, '', '/'); });
async function remove() {
  await userEvent.click((await screen.findAllByRole('button', { name: 'Account', exact: true }))[0]);
  await userEvent.type(screen.getByLabelText('Confirm with your password'), 'delete-password');
  await send();
}
// Moodie asks in its own words, in the page, every time.
async function send() {
  await userEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
  await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'Delete your account?' })).getByRole('button', { name: 'Delete account' }));
}
it('keeps the draft on server failure, then deletes only that account draft after success', async () => {
  await responseDraftStore.replace(3, null, newResponseDraft());
  await responseDraftStore.replace(4, null, newResponseDraft());
  mocks.deleteAccount.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  render(<App />);
  await remove();
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(await responseDraftStore.read(3)).not.toBeNull();
  await send();
  expect(await screen.findByRole('heading', { name: 'Account deleted' })).toBeInTheDocument();
  expect(await responseDraftStore.read(3)).toBeNull();
  expect(await responseDraftStore.read(4)).not.toBeNull();
  expect(window.location.pathname).toBe('/account-deleted');
});
it('never repeats a committed account deletion when local draft cleanup needs retry', async () => {
  await responseDraftStore.replace(3, null, newResponseDraft());
  const clear = vi.spyOn(responseDraftStore, 'clearAccount').mockRejectedValueOnce(new Error('storage unavailable'));
  render(<App />);
  await remove();
  expect(await screen.findByRole('heading', { name: 'Account deleted' })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('local draft could not be removed');
  await userEvent.click(screen.getByRole('button', { name: 'Remove local draft' }));
  expect(await screen.findByRole('status')).toHaveTextContent('local draft in this browser has been removed');
  expect(mocks.deleteAccount).toHaveBeenCalledTimes(1);
  expect(clear).toHaveBeenCalledTimes(2);
  expect(await responseDraftStore.read(3)).toBeNull();
});
