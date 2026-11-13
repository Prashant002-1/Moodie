import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import People from '../../src/pages/People';
const mocks = vi.hoisted(() => ({ people: vi.fn(), follow: vi.fn(), unfollow: vi.fn(), refresh: vi.fn() }));
vi.mock('../../src/contexts/UserContext', () => ({ useUser: () => ({ user: { id: 1 } }) }));
vi.mock('../../src/contexts/DiaryContext', () => ({ useDiary: () => ({ revision: 0, refresh: mocks.refresh }) }));
vi.mock('../../src/services/discoveryService', () => ({ discoveryService: { peoplePage: mocks.people, follow: mocks.follow, unfollow: mocks.unfollow } }));
const person = { id: 2, username: 'friend', bio: '', following: true, latest_title: null, latest_movie_id: null, latest_poster_path: null, latest_note: null, shared_film_title: null };
beforeEach(() => { vi.resetAllMocks(); mocks.people.mockResolvedValue({ people: [person], nextOffset: null }); });
it('loads one scoped page and reaches older connections explicitly', async () => {
  mocks.people.mockResolvedValueOnce({ people: [person], nextOffset: 30 }).mockResolvedValueOnce({ people: [{ ...person, id: 3, username: 'older' }], nextOffset: null });
  render(<MemoryRouter><People /></MemoryRouter>);
  await screen.findByRole('link', { name: '@friend' });
  expect(mocks.people).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole('button', { name: 'More people' }));
  expect(await screen.findByRole('link', { name: '@older' })).toHaveAttribute('href', '/member/older');
  expect(mocks.people).toHaveBeenLastCalledWith({ scope: 'following', q: undefined, limit: 30, offset: 30 }, expect.any(AbortSignal));
});
it('sends search and Discover scope to the server and clears the old scope while loading', async () => {
  render(<MemoryRouter><People /></MemoryRouter>);
  await screen.findByRole('link', { name: '@friend' });
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search people' }), 'shared film');
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
  await waitFor(() => expect(mocks.people).toHaveBeenLastCalledWith({ scope: 'following', q: 'shared film', limit: 30, offset: undefined }, expect.any(AbortSignal)));
  mocks.people.mockReturnValueOnce(new Promise(() => undefined));
  await userEvent.click(screen.getByRole('button', { name: 'Discover' }));
  expect(screen.queryByRole('link', { name: '@friend' })).not.toBeInTheDocument();
  await waitFor(() => expect(mocks.people).toHaveBeenLastCalledWith({ scope: 'discover', q: 'shared film', limit: 30, offset: undefined }, expect.any(AbortSignal)));
});
it('lists each person once: one profile link, what you share, their latest film and note, and Follow', async () => {
  mocks.people.mockResolvedValue({ people: [{ ...person, bio: 'Watches slowly', following: false, follows_you: true, shared_film_title: 'Shared Film',
    latest_title: 'Latest Film', latest_movie_id: 101, latest_poster_path: '/poster.jpg', latest_note: 'It stayed with me.' }], nextOffset: null });
  render(<MemoryRouter><People /></MemoryRouter>);
  const row = within((await screen.findByRole('link', { name: '@friend' })).closest('li')!);
  expect(row.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(['/member/friend', '/movie/101']);
  expect(row.getByRole('link', { name: 'Latest Film' })).toHaveAttribute('href', '/movie/101');
  expect(row.getByText('Watches slowly')).toBeInTheDocument();
  expect(row.getByText(/You both responded to/)).toHaveTextContent('You both responded to Shared Film');
  expect(row.getByText(/It stayed with me\./)).toBeInTheDocument();
  expect(row.getByText(/Follows you/)).toBeInTheDocument();
  expect(row.getByRole('button', { name: 'Follow @friend' })).toHaveAttribute('aria-pressed', 'false');
  expect(row.queryByRole('img')).not.toBeInTheDocument();
});
it('retains a failed follow action and invalidates related reads only after success', async () => {
  mocks.unfollow.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  render(<MemoryRouter><People /></MemoryRouter>);
  const button = await screen.findByRole('button', { name: 'Unfollow @friend' });
  await userEvent.click(button);
  expect(await screen.findByRole('alert')).toHaveTextContent('This connection could not be updated');
  expect(mocks.refresh).not.toHaveBeenCalled();
  await userEvent.click(button);
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
});
