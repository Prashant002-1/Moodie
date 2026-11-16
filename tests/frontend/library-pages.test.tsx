import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Diary from '../../src/pages/Diary';
import { SharedFilms } from '../../src/components/discovery/SharedFilms';
import { DiaryProvider, useDiary } from '../../src/contexts/DiaryContext';
import { useLibraryState } from '../../src/hooks/useLibraryState';

const mocks = vi.hoisted(() => ({ owner: 1, page: vi.fn(), savedPage: vi.fn(), summary: vi.fn(), create: vi.fn(), status: vi.fn(), shared: vi.fn() }));
vi.mock('../../src/contexts/UserContext', () => ({ useUser: () => ({ user: { id: mocks.owner } }) }));
vi.mock('../../src/services/diaryService', () => ({ diaryService: mocks }));
vi.mock('../../src/services/discoveryService', () => ({ discoveryService: { sharedFilms: mocks.shared } }));
const feelings = { happy: 1, neutral: 0, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0 };
const summary = { ...feelings, entries: 120, public_entries: 80, rewatches: 20, saved: 40, recent: { entries: 2, feelings } };
const first = { ...feelings, id: 11, movie_id: 101, user_id: 1, title: 'Recent film', note: 'My first page', visibility: 'private', watched_on: '2026-09-20', release_date: '2020-01-01', viewing_count: 7 };
const later = { ...first, id: 10, title: 'Earlier film', note: 'From the next page', watched_on: '2026-08-20' };
const ui = (child: React.ReactNode, path = '/diary') => <MemoryRouter initialEntries={[path]}><DiaryProvider>{child}</DiaryProvider></MemoryRouter>;
beforeEach(() => {
  vi.resetAllMocks(); mocks.owner = 1;
  mocks.summary.mockResolvedValue(summary);
  mocks.savedPage.mockResolvedValue({ films: [], nextOffset: null });
  mocks.page.mockResolvedValue({ entries: [first], nextOffset: 30 });
  mocks.status.mockImplementation(async (ids: number[]) => ids.map(id => ({ id, saved: id === 101, viewing_count: id === 101 ? 7 : 0 })));
});

it('opens with plain counts and no feeling statistics, and fetches older viewings only on request, grouped by month', async () => {
  mocks.page.mockResolvedValueOnce({ entries: [first], nextOffset: 30 }).mockResolvedValueOnce({ entries: [later], nextOffset: null });
  render(ui(<Diary />));
  expect(await screen.findByText('My first page')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'September 2026' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1, name: 'Diary' })).toBeInTheDocument();
  // The band carries counts of films and viewings only: 120 viewings of 100 films, 20 of them rewatches.
  const counts = within(await screen.findByRole('list', { name: 'Diary counts' })).getAllByRole('listitem').map(item => item.textContent);
  expect(counts).toEqual(['100Films', '20Rewatches', '2Last 30 days', '80Public']);
  expect(screen.queryByRole('region', { name: 'Recent diary summary' })).not.toBeInTheDocument();
  expect(screen.queryByText(/Last 30 viewing days/)).not.toBeInTheDocument();
  expect(screen.queryByText(/%|Joy \d|average/i)).not.toBeInTheDocument();
  expect(screen.getAllByLabelText(/^Feelings:/)).toHaveLength(1);
  const entry = screen.getByText('My first page').closest('article')!;
  expect(within(entry).getByRole('link', { name: 'Recent film' })).toHaveAttribute('href', '/response/11');
  expect(within(entry).getByRole('heading', { name: 'Recent film 2020' })).toBeInTheDocument();
  // The day is set large once; the whole date is still there to be read.
  expect(within(entry).getByText('20')).toBeInTheDocument();
  expect(within(entry).getByText('Sunday, September 20')).toBeInTheDocument();
  expect(within(entry).getByLabelText('Feelings: Joy')).toBeInTheDocument();
  expect(within(entry).getByText('Private')).toBeInTheDocument();
  expect(within(entry).getByRole('button', { name: 'Delete diary entry for Recent film' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Account' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Saved' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: '7 viewings' })).toHaveAttribute('href', '/diary?movieId=101');
  expect(screen.getByRole('link', { name: 'Edit diary entry for Recent film' })).toHaveAttribute('href', '/log?entryId=11');
  expect(mocks.page).toHaveBeenCalledTimes(1);
  expect(mocks.savedPage).toHaveBeenCalledWith({ limit: 12 }, expect.any(AbortSignal));
  await userEvent.click(screen.getByRole('button', { name: 'Older viewings' }));
  expect(await screen.findByText('From the next page')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'August 2026' })).toBeInTheDocument();
  expect(mocks.page.mock.calls[1][0]).toMatchObject({ offset: 30, limit: 30 });
});

it('sends diary filters to the server and clears the previous query before its result arrives', async () => {
  render(ui(<Diary />));
  await screen.findByText('My first page');
  let finish: (value: unknown) => void = () => undefined;
  mocks.page.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search your diary' }), 'old words');
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
  expect(screen.queryByText('My first page')).not.toBeInTheDocument();
  expect(mocks.page.mock.calls[1][0]).toMatchObject({ q: 'old words', offset: undefined, limit: 30 });
  finish({ entries: [later], nextOffset: null });
  expect(await screen.findByText('From the next page')).toBeInTheDocument();
  mocks.page.mockResolvedValueOnce({ entries: [], nextOffset: null });
  await userEvent.click(screen.getByRole('button', { name: 'Public' }));
  expect(await screen.findByText('No responses match these filters.')).toBeInTheDocument();
  expect(mocks.page.mock.calls[2][0]).toMatchObject({ q: 'old words', visibility: 'public', offset: undefined });
});

function Where() {
  const location = useLocation();
  return <p>{location.pathname}{location.search}</p>;
}
it('opens a film-scoped owner history and sends the old saved view to Recommendations', async () => {
  const view = render(ui(<Diary />, '/diary?movieId=101'));
  await screen.findByText('My first page');
  expect(mocks.page.mock.calls[0][0]).toMatchObject({ movieId: 101, limit: 30 });
  expect(screen.getByRole('link', { name: 'All viewings' })).toHaveAttribute('href', '/diary');
  view.unmount();
  mocks.page.mockClear();
  render(ui(<Routes><Route path="/diary" element={<Diary />} /><Route path="/suggestions" element={<Where />} /></Routes>, '/diary?view=saved'));
  expect(await screen.findByText('/suggestions?box=saved')).toBeInTheDocument();
  expect(mocks.page).not.toHaveBeenCalled();
  expect(mocks.savedPage).not.toHaveBeenCalledWith(expect.objectContaining({ limit: 30 }), expect.any(AbortSignal));
});

function ProviderProbe() {
  const { summary, savedFilms, createEntry, error } = useDiary();
  return <><p>{summary?.entries ?? 'No summary'} entries</p><p>{savedFilms.length} preview films</p><p role="alert">{error}</p><button onClick={async () => { await createEntry({ movieId: 101, watchedOn: '2020-01-01', note: '', visibility: 'private', emotions: feelings }); }}>Create viewing</button></>;
}
it('does not fetch full diary history and keeps a successful write successful if summaries fail', async () => {
  mocks.create.mockResolvedValue(first);
  const view = render(ui(<ProviderProbe />));
  await screen.findByText('120 entries');
  expect(mocks.page).not.toHaveBeenCalled();
  mocks.summary.mockRejectedValueOnce(new Error('offline'));
  await userEvent.click(screen.getByRole('button', { name: 'Create viewing' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('could not be refreshed'));
  expect(mocks.create).toHaveBeenCalledTimes(1);
  mocks.owner = 2;
  mocks.summary.mockReturnValue(new Promise(() => undefined));
  view.rerender(ui(<ProviderProbe />));
  expect(screen.queryByText('120 entries')).not.toBeInTheDocument();
});

function StatusProbe() {
  const library = useLibraryState([101, 102]);
  return <>{library.get(101) && <p>{library.get(101)?.saved ? 'Saved outside preview' : 'Not saved'}</p>}</>;
}
it('uses library state for visible films even when they are absent from the saved preview', async () => {
  render(ui(<StatusProbe />));
  expect(await screen.findByText('Saved outside preview')).toBeInTheDocument();
  expect(mocks.status).toHaveBeenCalledWith([101, 102], expect.any(AbortSignal));
  expect(mocks.page).not.toHaveBeenCalled();
});

it('requests shared-film evidence directly and keeps private context scoped to its viewer', async () => {
  mocks.shared.mockResolvedValue({ films: [{ id: 101, ownEntry: first, personEntry: { ...later, id: 30, title: 'Shared film', note: 'Their words' } }], nextOffset: 30 });
  const view = render(ui(<SharedFilms username="friend" />));
  expect(await screen.findByText('Their words')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Shared film' })).toBeInTheDocument();
  expect(screen.getByText('My first page')).toBeInTheDocument();
  expect(screen.getAllByLabelText('Feelings: Joy')).toHaveLength(2);
  expect(screen.getByText('Only you can see this')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /^Your response/ })).toHaveAttribute('href', '/response/11');
  expect(screen.getByRole('link', { name: /^Their response/ })).toHaveAttribute('href', '/response/30');
  expect(mocks.page).not.toHaveBeenCalled();
  expect(mocks.shared).toHaveBeenCalledTimes(1);
  mocks.owner = 2;
  mocks.shared.mockResolvedValue({ films: [], nextOffset: null });
  view.rerender(ui(<SharedFilms username="friend" />));
  expect(screen.queryByText('My first page')).not.toBeInTheDocument();
  await screen.findByText('No films in common.');
});
