import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';
import { UserProvider, useUser } from '../../src/contexts/UserContext';
import Auth from '../../src/pages/Auth';
import ProtectedRoute from '../../src/components/common/ProtectedRoute';

const mocks = vi.hoisted(() => ({ me: vi.fn(), register: vi.fn(), login: vi.fn(), logout: vi.fn() }));
vi.mock('../../src/services/authService', () => ({ authService: { ...mocks, clear: vi.fn() } }));
const user = { id: 2, email: 'alice@example.test', username: 'alice', bio: '' };
const unauthorized = { isAxiosError: true, response: { status: 401 } };
const Probe = () => {
  const { user, signOut } = useUser();
  return <><p>Opened for {user?.username}</p><button onClick={() => void signOut()}>Sign out</button></>;
};
const renderApp = (path: string) => render(<UserProvider><MemoryRouter initialEntries={[path]}><Routes>
  <Route path="/signup" element={<Auth mode="signup" />} />
  <Route path="/signin" element={<Auth mode="signin" />} />
  <Route path="/feed" element={<ProtectedRoute><Probe /></ProtectedRoute>} />
  <Route path="/log" element={<ProtectedRoute><p>Add a response</p></ProtectedRoute>} />
</Routes></MemoryRouter></UserProvider>);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.me.mockRejectedValue(unauthorized);
  mocks.register.mockResolvedValue({ user, recoveryCode: 'private-recovery-code' });
  mocks.login.mockResolvedValue({ user });
  mocks.logout.mockResolvedValue(undefined);
});

it('creates an account, asks the person to keep their recovery code, and opens their feed', async () => {
  renderApp('/signup');
  await userEvent.type(await screen.findByLabelText('Email'), user.email);
  await userEvent.type(screen.getByLabelText(/Username/), user.username);
  await userEvent.type(screen.getByLabelText(/^Password/), 'a-long-password');
  await userEvent.type(screen.getByLabelText('Confirm password'), 'a-long-password');
  await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));
  expect(await screen.findByText('private-recovery-code')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continue to Moodie' })).toBeDisabled();
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Continue to Moodie' }));
  expect(await screen.findByText('Opened for alice')).toBeInTheDocument();
  expect(mocks.register).toHaveBeenCalledWith({ email: user.email, username: user.username, password: 'a-long-password' });
});

it('restores the real account on refresh without opening a demo identity', async () => {
  mocks.me.mockResolvedValue(user);
  renderApp('/feed');
  expect(await screen.findByText('Opened for alice')).toBeInTheDocument();
  expect(mocks.register).not.toHaveBeenCalled(); expect(mocks.login).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
});

it('returns to a protected deep link after signing in', async () => {
  renderApp('/log?movieId=101');
  await userEvent.type(await screen.findByLabelText('Email or username'), 'alice');
  await userEvent.type(screen.getByLabelText('Password'), 'a-long-password');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText('Add a response')).toBeInTheDocument();
});

it('shows retry for an unavailable session instead of pretending the user is signed out', async () => {
  mocks.me.mockRejectedValueOnce(new Error('offline'));
  renderApp('/feed');
  expect(await screen.findByRole('alert')).toHaveTextContent('session could not be checked');
  mocks.me.mockResolvedValueOnce(user);
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Opened for alice')).toBeInTheDocument();
});

it('keeps a failed sign-in on the form with a useful error', async () => {
  mocks.login.mockRejectedValue({ isAxiosError: true, response: { status: 401, data: { error: 'Email, username, or password is incorrect.' } } });
  renderApp('/signin');
  await userEvent.type(await screen.findByLabelText('Email or username'), 'alice');
  await userEvent.type(screen.getByLabelText('Password'), 'wrong');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('password is incorrect');
});
