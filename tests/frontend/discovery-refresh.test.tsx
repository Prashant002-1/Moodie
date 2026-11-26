import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import Feed from '../../src/pages/Feed';
import Recommendations from '../../src/pages/Recommendations';
const state = vi.hoisted(() => ({ revision: 0, feed: vi.fn(), recommendations: vi.fn(), people: vi.fn(), pulse: vi.fn(), response: vi.fn() }));
vi.mock('../../src/contexts/UserContext', () => ({ useUser: () => ({ user: { id: 1, username: 'viewer' } }) }));
vi.mock('../../src/contexts/DiaryContext', () => ({ useDiary: () => ({ revision: state.revision, summary: { entries: 1 }, savedFilms: [], currentSignal: null, setCurrentSignal: vi.fn() }) }));
vi.mock('../../src/services/discoveryService', () => ({ discoveryService: { feedPage: state.feed, peoplePage: state.people, pulse: state.pulse, response: state.response, comments: async () => [] } }));
vi.mock('../../src/services/recommendationService', () => ({ recommendationService: { get: state.recommendations } }));
vi.mock('../../src/services/catalogService', () => ({ catalogService: { trending: async () => ({ results: [] }) } }));
vi.mock('../../src/services/suggestionService', () => ({ suggestionService: { list: async () => ({ suggestions: [], nextOffset: null }) } }));
const response = { id: 11, movie_id: 102, user_id: 2, username: 'peer', title: 'Next Film', watched_on: '2026-07-01', created_at: '2026-07-01T00:00:00Z', note: 'A joyful surprise', happy: .8, surprised: .2, following: true };
const movie = { id: 102, title: 'Next Film', recommended_by: [{ id: 2, username: 'peer', shared_film_title: 'Shared Film', shared_movie_id: 101, shared_response_id: 10, response_id: 11, shared_feelings: ['happy'], response_feelings: ['happy'], response_note: 'A joyful surprise', viewer_shared_note: 'My own joy', person_shared_note: 'Joy too' }] };
const recs = { profile: { connectedPeople: 1 }, forYou: [movie], adjacent: [], community: [] };

beforeEach(() => {
  vi.clearAllMocks();
  state.revision = 0;
  state.feed.mockResolvedValue({ entries: [response], nextCursor: null });
  state.response.mockResolvedValue(response);
  state.recommendations.mockResolvedValue(recs);
  state.people.mockResolvedValue({ people: [], nextOffset: null }); state.pulse.mockResolvedValue([]);
});

it('shows films through a shared film with their evidence above recent responses, and refreshes after the diary changes', async () => {
  const view = render(<MemoryRouter><Feed /></MemoryRouter>);
  const through = await screen.findByRole('region', { name: 'Through films you share' });
  expect(within(through).getByRole('link', { name: '@peer' })).toHaveAttribute('href', '/member/peer');
  expect(within(through).getByRole('heading', { name: 'Next Film' })).toBeInTheDocument();
  expect(within(through).getByRole('link', { name: 'Next Film' })).toHaveAttribute('href', '/movie/102?from=peer&through=Shared%20Film#response-11');
  expect(within(through).getByRole('link', { name: 'Shared Film' })).toHaveAttribute('href', '/response/10');
  expect(within(through).getByText('A joyful surprise')).toBeInTheDocument();
  expect(within(through).getByRole('button', { name: 'Save for later' })).toBeInTheDocument();
  expect(within(through).queryByRole('link', { name: /Open/ })).not.toBeInTheDocument();
  expect(within(through).getByRole('link', { name: 'See all' })).toHaveAttribute('href', '/recommendations');
  const recent = screen.getByRole('region', { name: 'Recent responses' });
  expect(await within(recent).findByText('A joyful surprise')).toBeInTheDocument();
  expect(within(recent).getByRole('link', { name: 'Read response' })).toHaveAttribute('href', '/response/11');
  state.recommendations.mockResolvedValue({ ...recs, forYou: [] });
  state.revision += 1;
  view.rerender(<MemoryRouter><Feed /></MemoryRouter>);
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Through films you share' })).not.toBeInTheDocument());
  expect(screen.getByRole('region', { name: 'Recent responses' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Following', exact: true }));
  expect(await screen.findByRole('region', { name: 'Responses from people you follow' })).toBeInTheDocument();
  await waitFor(() => expect(state.feed).toHaveBeenLastCalledWith({ scope: 'following', limit: 30, cursor: undefined }, expect.any(AbortSignal)));
});

it('shows at most three films through shared films on home', async () => {
  const more = [2, 3, 4].map(step => ({ ...movie, id: 102 + step, title: `Film ${step}` }));
  state.recommendations.mockResolvedValue({ ...recs, forYou: [movie, ...more] });
  render(<MemoryRouter><Feed /></MemoryRouter>);
  const through = await screen.findByRole('region', { name: 'Through films you share' });
  expect(within(through).getAllByRole('article')).toHaveLength(3);
  expect(within(through).queryByRole('heading', { name: 'Film 4' })).not.toBeInTheDocument();
});

it('offers a retry when recommendations fail instead of disguising the failure as an empty diary', async () => {
  state.recommendations.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(recs);
  render(<MemoryRouter><Feed /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Recommendations could not be loaded');
  expect(screen.queryByRole('region', { name: 'Through films you share' })).not.toBeInTheDocument();
  expect(screen.queryByText('Your diary is empty.')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('region', { name: 'Through films you share' })).toBeInTheDocument();
});

it('lists every film recommended through a shared film, each with its person and reason', async () => {
  state.recommendations.mockResolvedValue({ ...recs, adjacent: [{ ...movie, id: 103, title: 'Adjacent Film' }, { id: 104, title: 'Unconnected Film' }] });
  render(<MemoryRouter><Recommendations /></MemoryRouter>);
  expect(screen.getByRole('heading', { level: 1, name: 'Through films you share' })).toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: 'Next Film' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Adjacent Film' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Unconnected Film' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: '@peer' })[0]).toHaveAttribute('href', '/member/peer');
  expect(screen.getAllByText('A joyful surprise')).toHaveLength(2);
  expect(screen.getAllByRole('button', { name: 'Save for later' })).toHaveLength(2);
  expect(state.recommendations).toHaveBeenCalledWith(undefined);
  expect(screen.queryByRole('button', { name: /feel/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('search')).not.toBeInTheDocument();
});

it('says so plainly when nothing has been recommended through a shared film', async () => {
  state.recommendations.mockResolvedValue({ ...recs, forYou: [] });
  render(<MemoryRouter><Recommendations /></MemoryRouter>);
  expect(await screen.findByText('No recommendations.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Log a film' })).toHaveAttribute('href', '/log');
});

it('does not display stale recommendations after a revised diary fails to load', async () => {
  const view = render(<MemoryRouter><Recommendations /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Next Film' })).toBeInTheDocument();
  state.recommendations.mockRejectedValueOnce(new Error('offline'));
  state.revision += 1;
  view.rerender(<MemoryRouter><Recommendations /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Recommendations could not be loaded.');
  expect(screen.queryByRole('heading', { name: 'Next Film' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: 'Next Film' })).toBeInTheDocument();
});

it('shows recommendations from their own data when the feed is empty and asks only for the two feed pages', async () => {
  state.feed.mockResolvedValue({ entries: [], nextCursor: 'more' });
  render(<MemoryRouter><Feed /></MemoryRouter>);
  const through = await screen.findByRole('region', { name: 'Through films you share' });
  expect(within(through).getByText('A joyful surprise')).toBeInTheDocument();
  expect(await screen.findByText('No public responses yet.')).toBeInTheDocument();
  expect(state.feed.mock.calls.map(call => call[0])).toEqual(expect.arrayContaining([{ scope: 'everyone', limit: 12, cursor: undefined }, { scope: 'following', limit: 6 }]));
  expect(state.feed).toHaveBeenCalledTimes(2);
  expect(state.response).not.toHaveBeenCalled();
  expect(state.people).not.toHaveBeenCalled();
  expect(state.pulse).not.toHaveBeenCalled();
});

it('opens Following directly and requests its next cursor only when asked', async () => {
  state.feed.mockResolvedValueOnce({ entries: [response], nextCursor: 'second-page' }).mockResolvedValueOnce({ entries: [{ ...response, id: 12, note: 'An older response' }], nextCursor: null });
  render(<MemoryRouter initialEntries={['/feed?view=following']}><Feed /></MemoryRouter>);
  await screen.findByText('A joyful surprise');
  expect(state.feed).toHaveBeenCalledTimes(1);
  expect(state.recommendations).not.toHaveBeenCalled();
  expect(state.people).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Older responses' }));
  expect(await screen.findByText('An older response')).toBeInTheDocument();
  expect(state.feed).toHaveBeenLastCalledWith({ scope: 'following', limit: 30, cursor: 'second-page' }, expect.any(AbortSignal));
});
