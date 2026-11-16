import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MemberProfile from '../../src/pages/MemberProfile';
import MovieDetails from '../../src/pages/MovieDetails';
import Search from '../../src/pages/Search';
import { ResponseComments } from '../../src/components/discovery/ResponseComments';

const mocks = vi.hoisted(() => ({ profile: vi.fn(), connections: vi.fn(), filmEntriesPage: vi.fn(), commentsPage: vi.fn(), addComment: vi.fn(), deleteComment: vi.fn(), movie: vi.fn(), related: vi.fn(), search: vi.fn(), peoplePage: vi.fn(), pulse: vi.fn(), follow: vi.fn(), refresh: vi.fn() }));
vi.mock('../../src/contexts/UserContext', () => ({ useUser: () => ({ user: { id: 1, username: 'viewer' } }) }));
vi.mock('../../src/contexts/DiaryContext', () => ({ useDiary: () => ({ revision: 0, savedFilms: [], refresh: mocks.refresh }) }));
vi.mock('../../src/hooks/useLibraryState', () => ({ useLibraryState: () => ({ get: () => ({ saved: false, viewing_count: 0 }) }) }));
vi.mock('../../src/services/discoveryService', () => ({ discoveryService: mocks }));
vi.mock('../../src/services/catalogService', () => ({ catalogService: mocks }));
vi.mock('../../src/components/suggestions/SuggestionPreview', () => ({ SuggestionPreview: () => null }));
vi.mock('../../src/components/suggestions/KeepRecommendation', () => ({ KeepRecommendation: () => null }));
vi.mock('../../src/components/discovery/SafetyActions', () => ({ SafetyActions: () => null }));

const entry = { id: 11, movie_id: 101, user_id: 2, username: 'peer', title: 'A film', watched_on: '2026-09-01', created_at: '2026-09-01T00:00:00Z', note: 'The first response', happy: 1, neutral: 0, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0, visibility: 'public' };
const film = { id: 101, title: 'A film', overview: 'Cached synopsis', release_date: '2020-01-01', poster_path: null, backdrop_path: null };
const person = { id: 2, username: 'peer', bio: 'A person', entries: 80, films: 45, followers: 40, following_count: 70, follows_you: true, following: false };
const comment = { id: 1, entry_id: 11, user_id: 1, username: 'viewer', body: 'First comment', created_at: '2026-09-01T00:00:00Z', own: true };
const ui = (element: React.ReactNode, path = '/') => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/member/:username" element={element} /><Route path="/movie/:id" element={element} /><Route path="/" element={element} /></Routes></MemoryRouter>);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.profile.mockResolvedValue({ person, entries: [entry], nextOffset: 30 });
  mocks.connections.mockResolvedValue({ people: [{ id: 3, username: 'third', following: false }], nextOffset: 30 });
  mocks.filmEntriesPage.mockResolvedValue({ entries: [entry], nextOffset: 30, summary: { total: 80, happy: .25, sad: .75 }, film });
  mocks.movie.mockResolvedValue(film); mocks.related.mockResolvedValue([]);
  mocks.commentsPage.mockResolvedValue({ comments: [comment], total: 70, nextOffset: 30 });
  mocks.peoplePage.mockResolvedValue({ people: [], nextOffset: null }); mocks.pulse.mockResolvedValue([]);
});

it('uses authoritative profile counts and requests distinct film pages on the server', async () => {
  ui(<MemberProfile />, '/member/peer');
  await screen.findByText('The first response');
  // The counts sit once, in the band, not again on the tabs.
  const counts = screen.getByRole('group', { name: 'Profile counts' });
  expect(counts).toHaveTextContent('80 responses');
  expect(counts).toHaveTextContent('45 films');
  expect(screen.getByRole('button', { name: 'Responses' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('link', { name: 'Recommend a film' })).toHaveAttribute('href', '/suggestions/new?recipientId=2&recipient=peer');
  expect(mocks.connections).not.toHaveBeenCalled();
  mocks.profile.mockResolvedValueOnce({ person, entries: [{ ...entry, id: 12, movie_id: 102, title: 'Another film' }], nextOffset: null });
  await userEvent.click(screen.getByRole('button', { name: 'Films' }));
  await screen.findByText('Another film');
  expect(mocks.profile).toHaveBeenLastCalledWith('peer', { view: 'films', offset: undefined }, expect.any(AbortSignal));
  expect(screen.queryByText('A film')).not.toBeInTheDocument();
});

it('loads connections only when opened and continues independently from profile responses', async () => {
  ui(<MemberProfile />, '/member/peer');
  await screen.findByText('The first response');
  await userEvent.click(screen.getByRole('button', { name: '40 followers' }));
  await screen.findByText('@third');
  expect(mocks.connections).toHaveBeenCalledTimes(1);
  mocks.connections.mockResolvedValueOnce({ people: [{ id: 4, username: 'fourth', following: true }], nextOffset: null });
  await userEvent.click(screen.getByRole('button', { name: 'Load more people' }));
  await screen.findByText('@fourth');
  expect(mocks.connections).toHaveBeenLastCalledWith('peer', 'followers', 30, expect.any(AbortSignal));
  expect(mocks.profile).toHaveBeenCalledTimes(1);
});

it('keeps cached film and public responses when catalog fails, with the response total, feelings as words and lazy related loading', async () => {
  mocks.movie.mockRejectedValue(new Error('catalog offline'));
  ui(<MovieDetails />, '/movie/101');
  await screen.findByText('The first response');
  expect(screen.getByRole('heading', { level: 1, name: 'A film 2020' })).toBeInTheDocument();
  expect(screen.getByText('80 responses')).toBeInTheDocument();
  expect(screen.getByText('Cached synopsis')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Add response' })).toHaveAttribute('href', '/log?movieId=101');
  expect(screen.getByRole('link', { name: 'Recommend' })).toHaveAttribute('href', '/suggestions/new?movieId=101');
  expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  expect(screen.queryByText('What people felt')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Feelings: Joy')).toBeInTheDocument();
  expect(mocks.related).not.toHaveBeenCalled();
  mocks.filmEntriesPage.mockResolvedValueOnce({ entries: [{ ...entry, id: 12, note: 'Older followed response' }], nextOffset: null, summary: { total: 1, happy: 1 }, film });
  await userEvent.click(screen.getByRole('button', { name: 'Following', exact: true }));
  await screen.findByText('Older followed response');
  expect(mocks.filmEntriesPage).toHaveBeenLastCalledWith(101, { scope: 'following', offset: undefined }, expect.any(AbortSignal));
  expect(screen.queryByText('The first response')).not.toBeInTheDocument();
  mocks.related.mockRejectedValueOnce(new Error('related offline'));
  await userEvent.click(screen.getByRole('button', { name: 'More films' }));
  await screen.findByRole('button', { name: 'Retry related films' });
  expect(screen.queryByText('No related films found.')).not.toBeInTheDocument();
});

it('preserves comment totals across pages and acknowledges a successful post when refresh fails', async () => {
  ui(<ResponseComments entryId={11} initialCount={70} />);
  expect(mocks.commentsPage).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: '70 comments' }));
  await screen.findByText('First comment');
  mocks.commentsPage.mockResolvedValueOnce({ comments: [{ ...comment, id: 2, body: 'Second page comment' }], total: 70, nextOffset: null });
  await userEvent.click(screen.getByRole('button', { name: 'Load more comments' }));
  await screen.findByText('Second page comment');
  expect(screen.getByRole('button', { name: '70 comments' })).toBeInTheDocument();
  mocks.addComment.mockResolvedValueOnce({ ...comment, id: 71 });
  mocks.commentsPage.mockRejectedValueOnce(new Error('read offline'));
  await userEvent.type(screen.getByRole('textbox', { name: 'Write a comment' }), 'A new thought');
  await userEvent.click(screen.getByRole('button', { name: 'Post comment' }));
  await screen.findByText('Comment posted.');
  await screen.findByRole('button', { name: 'Retry comments' });
  expect(screen.getByRole('textbox', { name: 'Write a comment' })).toHaveValue('');
  expect(mocks.addComment).toHaveBeenCalledTimes(1);
});

it('clears comments and disables posting after access is revoked', async () => {
  ui(<ResponseComments entryId={11} initialCount={70} />);
  await userEvent.click(screen.getByRole('button', { name: '70 comments' }));
  await screen.findByText('First comment');
  mocks.commentsPage.mockRejectedValueOnce({ isAxiosError: true, response: { status: 404, data: { error: 'Response unavailable' } } });
  await userEvent.click(screen.getByRole('button', { name: 'Load more comments' }));
  await screen.findByText('Response unavailable');
  expect(screen.queryByText('First comment')).not.toBeInTheDocument();
  await userEvent.type(screen.getByRole('textbox', { name: 'Write a comment' }), 'A new thought');
  expect(screen.getByRole('button', { name: 'Post comment' })).toBeDisabled();
});

it('ignores an old film search result and pages the current query only on request', async () => {
  let resolveOld!: (value: unknown) => void;
  mocks.search.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
    .mockResolvedValueOnce({ results: [{ ...film, id: 102, title: 'New query film' }], page: 1, total_pages: 2 })
    .mockResolvedValueOnce({ results: [{ ...film, id: 103, title: 'Page two film' }], page: 2, total_pages: 2 });
  ui(<Search />);
  const input = screen.getByRole('searchbox', { name: 'Search films' });
  await userEvent.type(input, 'old'); await userEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
  await userEvent.clear(input); await userEvent.type(input, 'new'); await userEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
  await screen.findByRole('heading', { name: 'New query film' });
  // Results are a wall of posters, each with its own Save and Log.
  expect(screen.getByRole('link', { name: 'New query film' })).toHaveAttribute('href', '/movie/102');
  expect(screen.getByRole('link', { name: 'Log New query film' })).toHaveAttribute('href', '/log?movieId=102');
  expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-pressed', 'false');
  await act(async () => resolveOld({ results: [{ ...film, title: 'Stale query film' }], page: 1, total_pages: 1 }));
  expect(screen.queryByText('Stale query film')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Load more films' }));
  await screen.findByRole('heading', { name: 'Page two film' });
  expect(mocks.search).toHaveBeenLastCalledWith('new', 2, expect.any(AbortSignal));
  expect(mocks.peoplePage).not.toHaveBeenCalled();
});

it('searches people on the server without requiring the community catalog', async () => {
  mocks.pulse.mockRejectedValue(new Error('offline'));
  ui(<Search />);
  await userEvent.click(screen.getByRole('button', { name: 'People', exact: true }));
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search people' }), 'peer');
  await userEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
  await waitFor(() => expect(mocks.peoplePage).toHaveBeenLastCalledWith({ q: 'peer', offset: undefined }, expect.any(AbortSignal)));
  expect(screen.queryByRole('button', { name: 'Retry recent responses' })).not.toBeInTheDocument();
});
