import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import Feed from '../../src/pages/Feed';
import Recommendations from '../../src/pages/Recommendations';
const state = vi.hoisted(() => ({ revision: 0, feed: vi.fn(), films: vi.fn(), hidden: vi.fn(), introductions: vi.fn(), starter: vi.fn(), hide: vi.fn(), unhide: vi.fn(),
  follow: vi.fn(), unfollow: vi.fn(), createEntry: vi.fn(), updateEntry: vi.fn(), refresh: vi.fn(), people: vi.fn(), pulse: vi.fn(), response: vi.fn() }));
vi.mock('../../src/contexts/UserContext', () => ({ useUser: () => ({ user: { id: 1, username: 'viewer' } }) }));
vi.mock('../../src/contexts/DiaryContext', () => ({ useDiary: () => ({ revision: state.revision, summary: { entries: 1 }, savedFilms: [], refresh: state.refresh, createEntry: state.createEntry, updateEntry: state.updateEntry }) }));
vi.mock('../../src/services/discoveryService', () => ({ discoveryService: { feedPage: state.feed, peoplePage: state.people, pulse: state.pulse, response: state.response, follow: state.follow, unfollow: state.unfollow, comments: async () => [] } }));
vi.mock('../../src/services/pathService', () => ({ pathService: { films: state.films, hidden: state.hidden, introductions: state.introductions, starter: state.starter, hide: state.hide, unhide: state.unhide } }));
vi.mock('../../src/services/catalogService', () => ({ catalogService: { trending: async () => ({ results: [] }) } }));
vi.mock('../../src/services/suggestionService', () => ({ suggestionService: { list: async () => ({ suggestions: [], nextOffset: null }) } }));
const response = { id: 11, movie_id: 102, user_id: 2, username: 'peer', title: 'Next Film', watched_on: '2026-07-01', created_at: '2026-07-01T00:00:00Z', note: 'A joyful surprise', happy: .8, surprised: .2, following: true };
const shared = { kind: 'shared', film: { id: 101, title: 'Shared Film', release_date: null, poster_path: null }, feelings: ['happy', 'surprised'], own_response_id: 9, their_response_id: 10, own_enjoyment: 'loved', their_enjoyment: 'loved' };
const film = (id: number, title: string, reason: object = shared) => ({ film: { id, title, release_date: null, poster_path: null, overview: '' },
  paths: [{ person: { id: 2, username: 'peer' }, response: { id: 11, note: 'A joyful surprise', enjoyment: 'loved', feelings: ['happy'] }, reason }], more: 0, against: [] });
const page = (films: object[], more: object = {}) => ({ films, nextOffset: null, total: films.length, connected: true, diary: 9, ...more });

beforeEach(() => {
  vi.clearAllMocks();
  state.revision = 0;
  state.feed.mockResolvedValue({ entries: [response], nextCursor: null });
  state.response.mockResolvedValue(response);
  state.films.mockResolvedValue(page([film(102, 'Next Film')]));
  state.introductions.mockResolvedValue([]); state.starter.mockResolvedValue([]);
  state.hide.mockResolvedValue(undefined); state.unhide.mockResolvedValue(undefined);
  state.people.mockResolvedValue({ people: [], nextOffset: null }); state.pulse.mockResolvedValue([]);
});

it('shows a film through a person with what they made of it and what the two have in common, above recent responses', async () => {
  render(<MemoryRouter><Feed /></MemoryRouter>);
  const through = await screen.findByRole('region', { name: 'Through people' });
  expect(state.films).toHaveBeenCalledWith({ limit: 3 }, expect.any(AbortSignal));
  expect(within(through).getByRole('link', { name: 'peer' })).toHaveAttribute('href', '/member/peer');
  expect(within(through).getByText('loved it')).toBeInTheDocument();
  expect(within(through).getByRole('link', { name: 'Next Film' })).toHaveAttribute('href', '/movie/102#response-11');
  expect(within(through).getByText(/You both felt joy and wonder after/)).toBeInTheDocument();
  expect(within(through).getByRole('link', { name: 'Shared Film' })).toHaveAttribute('href', '/movie/101');
  expect(within(through).getByText('A joyful surprise')).toBeInTheDocument();
  expect(within(through).getByRole('button', { name: 'Save for later' })).toBeInTheDocument();
  expect(within(through).getByRole('link', { name: 'Seen it' })).toHaveAttribute('href', '/log?movieId=102');
  expect(within(through).getByRole('link', { name: /See all/ })).toHaveAttribute('href', '/recommendations');
  // No score, percentage or count of agreement anywhere.
  expect(through.textContent).not.toMatch(/%|\bmatch\b|score/i);
  const recent = screen.getByRole('region', { name: 'Recent responses' });
  expect(await within(recent).findByText('A joyful surprise')).toBeInTheDocument();
  expect(within(recent).getByRole('link', { name: 'Read response' })).toHaveAttribute('href', '/response/11');
});

it('says in words why a film comes through someone: a pick that landed, or nothing more when they are simply followed', async () => {
  state.films.mockResolvedValue(page([
    film(102, 'Landed Film', { kind: 'landed', film: { id: 90, title: 'Sent Film', release_date: null, poster_path: null }, enjoyment: 'loved' }),
    film(103, 'Followed Film', { kind: 'following' }),
    film(105, 'Friend Film', { kind: 'friend', through: [{ id: 4, username: 'clara' }] }),
    { ...film(104, 'Crowded Film', { kind: 'following' }), more: 2, against: [{ id: 7, username: 'doubter' }],
      paths: [...film(104, 'x').paths, { person: { id: 3, username: 'second' }, response: { id: 12, note: '', enjoyment: 'liked', feelings: [] }, reason: { kind: 'following' } }] },
  ]));
  render(<MemoryRouter><Feed /></MemoryRouter>);
  const landed = await screen.findByRole('article', { name: 'Landed Film' });
  expect(landed).toHaveTextContent('You loved Sent Film, which came from peer.');
  expect(screen.getByRole('article', { name: 'Followed Film' }).querySelector('.path__why')).toBeNull();
  expect(screen.getByRole('article', { name: 'Friend Film' })).toHaveTextContent('clara follows peer.');
  const crowded = screen.getByRole('article', { name: 'Crowded Film' });
  expect(crowded).toHaveTextContent('Also second and 2 more.');
  expect(crowded).toHaveTextContent('Not for doubter.');
});

it('sets a film aside where it stands, and takes that back', async () => {
  render(<MemoryRouter><Feed /></MemoryRouter>);
  const card = await screen.findByRole('article', { name: 'Next Film' });
  await userEvent.click(within(card).getByRole('button', { name: 'Next Film is not for me' }));
  expect(state.hide).toHaveBeenCalledWith(102);
  const through = screen.getByRole('region', { name: 'Through people' });
  expect(await within(through).findByRole('status')).toHaveTextContent('Next Film will not be offered again.');
  expect(within(through).queryByRole('button', { name: 'Save for later' })).not.toBeInTheDocument();
  await userEvent.click(within(through).getByRole('button', { name: 'Undo' }));
  expect(state.unhide).toHaveBeenCalledWith(102);
  expect(await within(through).findByRole('button', { name: 'Save for later' })).toBeInTheDocument();
});

it('keeps a film on screen and says so when setting it aside fails', async () => {
  state.hide.mockRejectedValueOnce(new Error('offline'));
  render(<MemoryRouter><Feed /></MemoryRouter>);
  const card = await screen.findByRole('article', { name: 'Next Film' });
  await userEvent.click(within(card).getByRole('button', { name: 'Next Film is not for me' }));
  expect(await within(card).findByRole('alert')).toHaveTextContent('That could not be saved. Try again.');
  expect(within(card).getByRole('button', { name: 'Save for later' })).toBeInTheDocument();
});

it('does not reshuffle the films on home when the diary changes, and fills them in once there are some', async () => {
  const view = render(<MemoryRouter><Feed /></MemoryRouter>);
  await screen.findByRole('article', { name: 'Next Film' });
  state.films.mockResolvedValue(page([film(105, 'Another Film')]));
  state.revision += 1;
  view.rerender(<MemoryRouter><Feed /></MemoryRouter>);
  await waitFor(() => expect(state.films).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('article', { name: 'Next Film' })).toBeInTheDocument();
  expect(screen.queryByRole('article', { name: 'Another Film' })).not.toBeInTheDocument();
  view.unmount();
  state.films.mockResolvedValueOnce(page([], { connected: false, diary: 0 })).mockResolvedValue(page([film(106, 'First Film')], { diary: 2 }));
  const fresh = render(<MemoryRouter><Feed /></MemoryRouter>);
  await screen.findByRole('region', { name: 'Recent responses' });
  expect(screen.queryByRole('region', { name: 'Through people' })).not.toBeInTheDocument();
  state.revision += 1;
  fresh.rerender(<MemoryRouter><Feed /></MemoryRouter>);
  expect(await screen.findByRole('article', { name: 'First Film' })).toBeInTheDocument();
});

it('asks someone with almost nothing in their diary about films they may have seen, and saves each answer as it is given', async () => {
  state.films.mockResolvedValue(page([], { connected: false, diary: 0 }));
  state.starter.mockResolvedValue([{ id: 201, title: 'Well Known', release_date: null, poster_path: null }]);
  state.createEntry.mockResolvedValue({ id: 77 });
  state.updateEntry.mockResolvedValue({ id: 77 });
  render(<MemoryRouter><Feed /></MemoryRouter>);
  const asked = await screen.findByRole('region', { name: 'Films you may have seen' });
  await userEvent.click(await within(asked).findByRole('button', { name: 'I have seen Well Known' }));
  await userEvent.click(within(screen.getByRole('group', { name: 'How was Well Known?' })).getByRole('button', { name: 'Loved it' }));
  expect(state.createEntry).toHaveBeenCalledWith(expect.objectContaining({ movieId: 201, note: '', visibility: 'public', enjoyment: 'loved' }));
  expect(await within(asked).findByRole('button', { name: 'Well Known: Loved it. Change' })).toBeInTheDocument();
  // The feelings are offered next, never required.
  await userEvent.click(within(asked).getByRole('button', { name: 'Wonder' }));
  await waitFor(() => expect(state.updateEntry).toHaveBeenCalledWith(77, expect.objectContaining({ enjoyment: 'loved', emotions: expect.objectContaining({ surprised: 1 }) })));
});

it('keeps an answer private when the person says only they should see it', async () => {
  state.films.mockResolvedValue(page([], { connected: false, diary: 0 }));
  state.starter.mockResolvedValue([{ id: 201, title: 'Well Known', release_date: null, poster_path: null }]);
  state.createEntry.mockResolvedValue({ id: 78 });
  render(<MemoryRouter><Feed /></MemoryRouter>);
  const asked = await screen.findByRole('region', { name: 'Films you may have seen' });
  await userEvent.click(await within(asked).findByRole('button', { name: 'Only me' }));
  await userEvent.click(within(asked).getByRole('button', { name: 'I have seen Well Known' }));
  await userEvent.click(within(asked).getByRole('button', { name: 'Mixed' }));
  expect(state.createEntry).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'private', enjoyment: 'mixed' }));
});

it('does not ask someone with a diary about films they may have seen', async () => {
  render(<MemoryRouter><Feed /></MemoryRouter>);
  await screen.findByRole('region', { name: 'Through people' });
  expect(screen.queryByRole('region', { name: 'Films you may have seen' })).not.toBeInTheDocument();
  expect(state.starter).not.toHaveBeenCalled();
});

it('introduces people with the reason and follows them in place', async () => {
  state.introductions.mockResolvedValue([{ id: 5, username: 'kindred', bio: '', following: false, follows_you: true, shared: { ...shared, count: 1 }, mutuals: [{ id: 2, username: 'peer' }], latest: null }]);
  state.follow.mockResolvedValue(undefined);
  render(<MemoryRouter><Feed /></MemoryRouter>);
  const meet = await screen.findByRole('region', { name: 'People to meet' });
  expect(meet).toHaveTextContent('You both felt joy and wonder after Shared Film.');
  expect(meet).toHaveTextContent('peer follows them.');
  expect(meet).toHaveTextContent('Follows you.');
  await userEvent.click(within(meet).getByRole('button', { name: 'Follow @kindred' }));
  expect(state.follow).toHaveBeenCalledWith(5);
  expect(await within(meet).findByRole('button', { name: 'Unfollow @kindred' })).toHaveAttribute('aria-pressed', 'true');
});

it('offers a retry when films through people fail instead of disguising the failure as an empty diary', async () => {
  state.films.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(page([film(102, 'Next Film')]));
  render(<MemoryRouter><Feed /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Recommendations could not be loaded');
  expect(screen.queryByRole('region', { name: 'Through people' })).not.toBeInTheDocument();
  expect(screen.queryByText('Your diary is empty.')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('region', { name: 'Through people' })).toBeInTheDocument();
});

it('lists every film through people on its own page and reads more only when asked', async () => {
  state.films.mockResolvedValueOnce({ ...page([film(102, 'Next Film'), film(103, 'Second Film')]), nextOffset: 12 }).mockResolvedValueOnce(page([film(104, 'Third Film')]));
  render(<MemoryRouter><Recommendations /></MemoryRouter>);
  expect(screen.getByRole('heading', { level: 1, name: 'Through people' })).toBeInTheDocument();
  expect(await screen.findByRole('heading', { level: 2, name: 'Next Film' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Second Film' })).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Save for later' })).toHaveLength(2);
  expect(state.films).toHaveBeenCalledTimes(1);
  expect(state.films).toHaveBeenCalledWith({ limit: 12, offset: undefined }, expect.any(AbortSignal));
  expect(screen.queryByRole('button', { name: /feel/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('search')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'More films' }));
  expect(await screen.findByRole('heading', { name: 'Third Film' })).toBeInTheDocument();
  expect(state.films).toHaveBeenLastCalledWith({ limit: 12, offset: 12 }, expect.any(AbortSignal));
  expect(screen.queryByRole('button', { name: 'More films' })).not.toBeInTheDocument();
});

it('says plainly when there is nothing new, and gives someone with no connections a place to start', async () => {
  state.films.mockResolvedValue(page([]));
  const view = render(<MemoryRouter><Recommendations /></MemoryRouter>);
  expect(await screen.findByText('Nothing new through the people you know.')).toBeInTheDocument();
  view.unmount();
  state.films.mockResolvedValue(page([], { connected: false, diary: 0 }));
  state.starter.mockResolvedValue([{ id: 201, title: 'Well Known', release_date: null, poster_path: null }]);
  render(<MemoryRouter><Recommendations /></MemoryRouter>);
  expect(await screen.findByText(/Films reach you here through people/)).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'I have seen Well Known' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Log another film' })).toHaveAttribute('href', '/log');
});

it('keeps the list in place when the diary changes, reads it again while it is empty, and offers a retry when it cannot be read', async () => {
  const view = render(<MemoryRouter><Recommendations /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Next Film' })).toBeInTheDocument();
  state.revision += 1;
  view.rerender(<MemoryRouter><Recommendations /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Next Film' })).toBeInTheDocument();
  expect(state.films).toHaveBeenCalledTimes(1);
  view.unmount();
  state.films.mockReset();
  state.revision = 0;
  state.films.mockResolvedValueOnce(page([], { connected: false, diary: 0 })).mockResolvedValue(page([film(107, 'After An Answer')]));
  const empty = render(<MemoryRouter><Recommendations /></MemoryRouter>);
  await screen.findByText(/Films reach you here through people/);
  state.revision += 1;
  empty.rerender(<MemoryRouter><Recommendations /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'After An Answer' })).toBeInTheDocument();
  empty.unmount();
  state.films.mockReset();
  state.films.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(page([film(102, 'Next Film')]));
  render(<MemoryRouter><Recommendations /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Films could not be loaded.');
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: 'Next Film' })).toBeInTheDocument();
});

it('shows films through people when the feed is empty, shows one poster per friend, and asks only for the two feed pages', async () => {
  state.feed.mockResolvedValue({ entries: [], nextCursor: 'more' });
  render(<MemoryRouter><Feed /></MemoryRouter>);
  const through = await screen.findByRole('region', { name: 'Through people' });
  expect(within(through).getByText('A joyful surprise')).toBeInTheDocument();
  expect(await screen.findByText('No public responses yet.')).toBeInTheDocument();
  expect(state.feed.mock.calls.map(call => call[0])).toEqual(expect.arrayContaining([{ scope: 'everyone', limit: 12, cursor: undefined, kind: 'written' }, { scope: 'following', limit: 18 }]));
  expect(state.feed).toHaveBeenCalledTimes(2);
  expect(state.response).not.toHaveBeenCalled();
  expect(state.people).not.toHaveBeenCalled();
  expect(state.pulse).not.toHaveBeenCalled();
});

it('shows each friend once on the wall, with their latest film', async () => {
  const other = { ...response, id: 30, user_id: 9, username: 'stranger', note: 'From someone else', following: false };
  state.feed.mockImplementation(async (params: { scope: string }) => params.scope === 'following'
    ? { entries: [response, { ...response, id: 12, title: 'Older Film' }, { ...response, id: 13, user_id: 3, username: 'second', title: 'Second Film' }], nextCursor: null }
    : { entries: [other], nextCursor: null });
  render(<MemoryRouter><Feed /></MemoryRouter>);
  const wall = await screen.findByRole('region', { name: 'New from people you follow' });
  expect(within(wall).getAllByRole('article')).toHaveLength(2);
  expect(within(wall).getByRole('link', { name: 'peer on Next Film' })).toBeInTheDocument();
  expect(within(wall).queryByRole('link', { name: 'peer on Older Film' })).not.toBeInTheDocument();
});

it('opens Following directly, asks for written responses, and requests its next cursor only when asked', async () => {
  state.feed.mockResolvedValueOnce({ entries: [response], nextCursor: 'second-page' }).mockResolvedValueOnce({ entries: [{ ...response, id: 12, note: 'An older response' }], nextCursor: null });
  render(<MemoryRouter initialEntries={['/feed?view=following']}><Feed /></MemoryRouter>);
  await screen.findByText('A joyful surprise');
  expect(state.feed).toHaveBeenCalledTimes(1);
  expect(state.films).not.toHaveBeenCalled();
  expect(state.people).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Older responses' }));
  expect(await screen.findByText('An older response')).toBeInTheDocument();
  expect(state.feed).toHaveBeenLastCalledWith({ scope: 'following', limit: 30, cursor: 'second-page', kind: 'written' }, expect.any(AbortSignal));
});

it('lists films that were set aside only when asked, and offers one again', async () => {
  state.hidden.mockResolvedValue([{ id: 301, title: 'Set Aside Film', release_date: null, poster_path: null }]);
  render(<MemoryRouter><Recommendations /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Next Film' });
  expect(state.hidden).not.toHaveBeenCalled();
  await userEvent.click(screen.getByText('Films you set aside'));
  await userEvent.click(await screen.findByRole('button', { name: 'Offer Set Aside Film again' }));
  expect(state.unhide).toHaveBeenCalledWith(301);
  await waitFor(() => expect(screen.queryByRole('link', { name: 'Set Aside Film' })).not.toBeInTheDocument());
});
