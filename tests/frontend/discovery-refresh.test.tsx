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

it('shows complete connected responses, links to their exact evidence, and refreshes after the diary changes', async () => {
  const view = render(<MemoryRouter><Feed /></MemoryRouter>);
  const connected = await screen.findByRole('region', { name: 'Responses connected to your diary' });
  expect(within(connected).getByText('A joyful surprise')).toBeInTheDocument();
  expect(within(connected).getByRole('link', { name: 'Read response' })).toHaveAttribute('href', '/response/11');
  expect(screen.getByRole('link', { name: 'Shared Film' })).toHaveAttribute('href', '/response/10');
  state.recommendations.mockResolvedValue({ ...recs, forYou: [] });
  state.revision += 1;
  view.rerender(<MemoryRouter><Feed /></MemoryRouter>);
  expect(await screen.findByText('No connected films yet.')).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Responses connected to your diary' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Following', exact: true }));
  expect(await screen.findByRole('region', { name: 'Responses from people you follow' })).toBeInTheDocument();
  await waitFor(() => expect(state.feed).toHaveBeenLastCalledWith({ scope: 'following', limit: 30, cursor: undefined }, expect.any(AbortSignal)));
});

it('offers a retry when recommendations fail instead of disguising the failure as an empty diary', async () => {
  state.recommendations.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(recs);
  render(<MemoryRouter><Feed /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Recommendations could not be loaded');
  expect(screen.queryByText('No connected films yet.')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('region', { name: 'Responses connected to your diary' })).toBeInTheDocument();
});

it('does not display stale recommendations after a revised diary fails to load', async () => {
  const view = render(<MemoryRouter><Recommendations /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Next Film' })).toBeInTheDocument();
  state.recommendations.mockRejectedValueOnce(new Error('offline'));
  state.revision += 1;
  view.rerender(<MemoryRouter><Recommendations /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Recommendations could not be loaded.')).toBeInTheDocument());
  expect(screen.queryByRole('heading', { name: 'Next Film' })).not.toBeInTheDocument();
});


it('opens connected responses outside the first feed page and isolates recent-film failure', async () => {
  state.feed.mockResolvedValue({ entries: [], nextCursor: 'more' });
  state.pulse.mockRejectedValue(new Error('offline'));
  render(<MemoryRouter><Feed /></MemoryRouter>);
  const connected = await screen.findByRole('region', { name: 'Responses connected to your diary' });
  expect(within(connected).getByText('A joyful surprise')).toBeInTheDocument();
  expect(state.response).toHaveBeenCalledWith(11, expect.any(AbortSignal));
  expect(state.feed.mock.calls.map(call => call[0])).toEqual(expect.arrayContaining([{ scope: 'everyone', limit: 12, cursor: undefined }, { scope: 'following', limit: 4 }]));
  expect(state.feed).toHaveBeenCalledTimes(2);
  expect(state.people).toHaveBeenCalledWith({ limit: 6 }, expect.any(AbortSignal));
  expect(screen.getByRole('alert')).toHaveTextContent('Recent films could not be loaded');
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
