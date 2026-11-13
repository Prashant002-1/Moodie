import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';

const mocks = vi.hoisted(() => ({ me: vi.fn(), register: vi.fn(), recover: vi.fn(), summary: vi.fn(), savedPage: vi.fn() }));
vi.mock('../../src/services/authService', () => ({ authService: { me: mocks.me, register: mocks.register, recover: mocks.recover, clear: vi.fn() } }));
vi.mock('../../src/services/diaryService', () => ({ diaryService: { summary: mocks.summary, savedPage: mocks.savedPage } }));
vi.mock('../../src/components/motion/SmoothScroll', () => ({ default: () => null }));
const user = { id: 3, username: 'new_member', email: 'member@example.test', bio: '' };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.me.mockRejectedValue({ isAxiosError: true, response: { status: 401 } });
  mocks.register.mockResolvedValue({ user, recoveryCode: 'keep-this-code' });
  mocks.recover.mockResolvedValue({ user, recoveryCode: 'replacement-code' });
});
afterEach(() => { window.history.replaceState({}, '', '/'); });

it.each(['signup', 'recover'] as const)('keeps the %s receipt mounted when authentication changes and does not preload private library data', async mode => {
  window.history.replaceState({}, '', `/${mode}`);
  render(<App />);
  if (mode === 'signup') {
    await userEvent.type(await screen.findByLabelText('Email'), user.email);
    await userEvent.type(screen.getByLabelText(/Username/), user.username);
    await userEvent.type(screen.getByLabelText(/^Password/), 'long-test-password');
  } else {
    await userEvent.type(await screen.findByLabelText('Email or username'), user.username);
    await userEvent.type(screen.getByLabelText('Recovery code'), 'old-code');
    await userEvent.type(screen.getByLabelText(/^New password/), 'long-test-password');
  }
  await userEvent.type(screen.getByLabelText('Confirm password'), 'long-test-password');
  await userEvent.click(screen.getByRole('button', { name: mode === 'signup' ? 'Sign up' : 'Recover your account' }));
  expect(await screen.findByRole('heading', { name: 'Keep your recovery code' })).toBeInTheDocument();
  expect(screen.getByText(mode === 'signup' ? 'keep-this-code' : 'replacement-code')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continue to Moodie' })).toBeDisabled();
  expect(window.location.pathname).toBe(`/${mode}`);
  expect(mocks.summary).not.toHaveBeenCalled();
  expect(mocks.savedPage).not.toHaveBeenCalled();
});
