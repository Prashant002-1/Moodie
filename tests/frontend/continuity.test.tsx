import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import Search from '../../src/pages/Search';
import People from '../../src/pages/People';
import Log from '../../src/pages/Log';
import SendSuggestion from '../../src/pages/SendSuggestion';
import { KeepRecommendation } from '../../src/components/suggestions/KeepRecommendation';
import { responseDraftStore } from '../../src/services/responseDraftStore';
import { newResponseDraft } from '../../src/types/responseDraft';

// A person keeps their place: what they searched, where they were reading and
// what they were writing survive the ordinary moves between screens.
const mocks = vi.hoisted(() => ({
  search: vi.fn(), pulse: vi.fn(), movie: vi.fn(), peoplePage: vi.fn(), follow: vi.fn(), unfollow: vi.fn(), response: vi.fn(),
  create: vi.fn(), recipients: vi.fn(), list: vi.fn(), refresh: vi.fn(), createEntry: vi.fn(), updateEntry: vi.fn(),
}));
vi.mock('../../src/contexts/UserContext', () => ({ useUser: () => ({ user: { id: 1, username: 'viewer' } }) }));
vi.mock('../../src/contexts/DiaryContext', () => ({ useDiary: () => ({ revision: 0, savedFilms: [], refresh: mocks.refresh, createEntry: mocks.createEntry, updateEntry: mocks.updateEntry }) }));
vi.mock('../../src/hooks/useLibraryState', () => ({ useLibraryState: () => ({ get: () => ({ saved: false, viewing_count: 0 }) }) }));
vi.mock('../../src/services/discoveryService', () => ({ discoveryService: mocks }));
vi.mock('../../src/services/catalogService', () => ({ catalogService: mocks }));
vi.mock('../../src/services/suggestionService', () => ({ suggestionService: mocks }));
vi.mock('../../src/services/pathService', () => ({ pathService: { films: async () => ({ films: [], nextOffset: null, total: 0, connected: true, diary: 1 }), recipients: async () => ({ people: [], wrote: [] }) } }));

const film = { id: 10, title: 'Scream', poster_path: null, backdrop_path: null, release_date: '1996-12-20' };
const person = { id: 2, username: 'friend', bio: '', following: false, latest_title: null, latest_movie_id: null, latest_poster_path: null, latest_note: null, shared_film_title: null };
const Where = () => { const location = useLocation(); return <p data-testid="where">{location.pathname}{location.search}</p>; };
const at = (path: string, element: React.ReactNode) => render(<MemoryRouter initialEntries={[path]}>
  <Routes><Route path="/diary" element={<p>Diary destination</p>} /><Route path="*" element={<>{element}<Where /></>} /></Routes>
</MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.pulse.mockResolvedValue([]); mocks.movie.mockResolvedValue(film);
  mocks.search.mockResolvedValue({ results: [film], page: 1, total_pages: 1 });
  mocks.peoplePage.mockResolvedValue({ people: [person], nextOffset: null });
  mocks.list.mockResolvedValue({ suggestions: [], nextOffset: null });
  mocks.recipients.mockResolvedValue([]);
});

it('names the page in the document title and gives the name back when leaving', async () => {
  const view = at('/search', <Search />);
  await waitFor(() => expect(document.title).toBe('Search · Moodie'));
  view.unmount();
  expect(document.title).toBe('Moodie');
});

it('reads a search from the address, so going back to it shows the same results', async () => {
  at('/search?q=scream', <Search />);
  expect(await screen.findByRole('heading', { name: 'Scream' })).toBeInTheDocument();
  expect(mocks.search).toHaveBeenCalledWith('scream', 1, expect.any(AbortSignal));
  const input = screen.getByRole('searchbox', { name: 'Search films' });
  expect(input).toHaveValue('scream');
  await userEvent.clear(input); await userEvent.type(input, 'past lives{Enter}');
  await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/search?q=past+lives'));
  // The query is kept when moving between films and people.
  await userEvent.click(screen.getByRole('button', { name: 'People' }));
  await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/search?view=people&q=past+lives'));
  await waitFor(() => expect(mocks.peoplePage).toHaveBeenLastCalledWith({ q: 'past lives', offset: undefined }, expect.any(AbortSignal)));
});

it('offers Discover from an empty Following list and keeps the tab in the address', async () => {
  mocks.peoplePage.mockResolvedValueOnce({ people: [], nextOffset: null });
  at('/people', <People />);
  expect(await screen.findByText('You are not following anyone.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Discover people' }));
  expect(await screen.findByRole('link', { name: '@friend' })).toBeInTheDocument();
  expect(screen.getByTestId('where')).toHaveTextContent('/people?view=discover');
  expect(mocks.peoplePage).toHaveBeenLastCalledWith({ scope: 'discover', q: undefined, limit: 30, offset: undefined }, expect.any(AbortSignal));
});

it('keeps a followed person in place with their new state instead of reloading the list', async () => {
  mocks.follow.mockResolvedValue(undefined);
  at('/people?view=discover', <People />);
  await userEvent.click(await screen.findByRole('button', { name: 'Follow @friend' }));
  expect(await screen.findByRole('button', { name: 'Unfollow @friend' })).toHaveAttribute('aria-pressed', 'true');
  expect(mocks.peoplePage).toHaveBeenCalledTimes(1);
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});

it('saves a film for later without leaving what the person was reading', async () => {
  mocks.create.mockResolvedValue({ id: 31 });
  at('/feed', <KeepRecommendation entryId={15} authorId={2} movieId={10} />);
  await userEvent.click(screen.getByRole('button', { name: 'Save for later' }));
  expect(await screen.findByRole('link', { name: /^Saved for later/ })).toHaveAttribute('href', '/suggestions/31');
  expect(screen.getByTestId('where')).toHaveTextContent('/feed');
});

it('says who a recommendation can go to before any film is chosen when nobody follows the person', async () => {
  at('/suggestions/new', <SendSuggestion />);
  expect(await screen.findByText(/Nobody follows you yet/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Find people' })).toHaveAttribute('href', '/people?view=discover');
  expect(screen.queryByRole('searchbox', { name: 'Find a film to recommend' })).not.toBeInTheDocument();
});

it('does not keep, or ask about, a response nobody has started writing', async () => {
  // A film was once chosen and nothing more: opening another film just opens it.
  await responseDraftStore.replace(1, null, newResponseDraft(film));
  mocks.movie.mockResolvedValue({ ...film, id: 20, title: 'Another Film' });
  at('/log?movieId=20', <Log />);
  expect(await screen.findByRole('heading', { name: 'Another Film' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Continue your draft?' })).not.toBeInTheDocument();
  // Save says what it is waiting for.
  expect(screen.getByRole('button', { name: 'Save response' })).toBeDisabled();
  expect(screen.getByText('Choose at least one feeling to save.')).toBeInTheDocument();
  // Closing with nothing written asks nothing and leaves nothing behind.
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(await screen.findByText('Diary destination')).toBeInTheDocument();
  expect(screen.queryByText('Keep this draft?')).not.toBeInTheDocument();
  expect(await responseDraftStore.read(1)).toBeNull();
});
