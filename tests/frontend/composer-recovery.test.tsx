import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Log from '../../src/pages/Log';
import { responseDraftStore } from '../../src/services/responseDraftStore';
import { newResponseDraft } from '../../src/types/responseDraft';

const mocks = vi.hoisted(() => ({ ownerId: 1, create: vi.fn(), update: vi.fn(), movie: vi.fn(), response: vi.fn(), recommendations: vi.fn() }));
vi.mock('../../src/contexts/UserContext', () => ({ useUser: () => ({ user: { id: mocks.ownerId } }) }));
vi.mock('../../src/contexts/DiaryContext', () => ({ useDiary: () => ({ createEntry: mocks.create, updateEntry: mocks.update, savedFilms: [] }) }));
vi.mock('../../src/services/catalogService', () => ({ catalogService: { movie: mocks.movie } }));
vi.mock('../../src/services/discoveryService', () => ({ discoveryService: { response: mocks.response, pulse: async () => [] } }));
vi.mock('../../src/services/suggestionService', () => ({ suggestionService: { list: async () => ({ suggestions: [], nextOffset: null }) } }));
vi.mock('../../src/services/pathService', () => ({ pathService: { films: mocks.recommendations, recipients: async () => ({ people: [], wrote: [] }) } }));
const film = { id: 10, title: 'Scream', poster_path: null, release_date: '1996-12-20' };
const draft = () => ({ ...newResponseDraft(film), note: 'Only for me', emotions: { ...newResponseDraft().emotions, happy: .8 }, enjoyment: 'loved' as const,
  highlights: ['performances' as const], expressionImage: 'data:image/jpeg;base64,cGhvdG8=', suggestionId: 7, suggestionName: 'ananya' });
const ui = (path = '/log') => <MemoryRouter initialEntries={[path]}><Routes><Route path="/log" element={<Log />} /><Route path="/diary" element={<p>Diary destination</p>} /></Routes></MemoryRouter>;
beforeEach(() => {
  vi.resetAllMocks(); mocks.ownerId = 1;
  mocks.movie.mockResolvedValue(film);
  mocks.recommendations.mockResolvedValue({ films: [], nextOffset: null, total: 0, connected: true, diary: 1 });
});

it('recovers attribution, photo, feelings and the identical failed request after relaunch', async () => {
  const original = draft();
  await responseDraftStore.replace(1, null, original);
  mocks.create.mockRejectedValueOnce(new Error('connection lost')).mockResolvedValueOnce({ id: 91, title: film.title, visibility: 'private' });
  const first = render(ui());
  expect(await screen.findByLabelText('Note')).toHaveValue(original.note);
  expect(screen.getByRole('img', { name: 'Photo preview' })).toHaveAttribute('src', original.expressionImage);
  expect(screen.getByRole('button', { name: /^Joy ?, strongest$/ })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  expect(within(screen.getByRole('group', { name: 'How was it?' })).getByRole('button', { name: 'Loved it' })).toHaveAttribute('aria-pressed', 'true');
  expect(within(screen.getByRole('group', { name: 'What stood out?' })).getByRole('button', { name: 'Performances' })).toHaveAttribute('aria-pressed', 'true');
  await userEvent.click(screen.getByRole('button', { name: 'Save response' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved');
  const firstRequest = mocks.create.mock.calls[0][0];
  first.unmount();
  render(ui());
  await userEvent.click(await screen.findByRole('button', { name: 'Save response' }));
  expect(await screen.findByRole('link', { name: 'Reply to ananya' })).toHaveAttribute('href', '/suggestions/7');
  expect(mocks.create.mock.calls[1][0]).toEqual(firstRequest);
  expect(firstRequest).toMatchObject({ clientRequestId: original.clientRequestId, suggestionId: 7, expressionImage: original.expressionImage, enjoyment: 'loved', highlights: ['performances'], visibility: 'private' });
  await waitFor(async () => expect(await responseDraftStore.read(1)).toBeNull());
});

it('keeps a saved response recoverable when the incoming film cannot be loaded', async () => {
  await responseDraftStore.replace(1, null, draft());
  mocks.movie.mockRejectedValue(new Error('Film unavailable'));
  render(ui('/log?movieId=20'));
  await screen.findByRole('heading', { name: 'Continue your draft?' });
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Discard draft and start new' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Continue draft' }));
  expect(screen.getByLabelText('Note')).toHaveValue('Only for me');
  expect(screen.getByRole('heading', { name: 'Scream' })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('requires an explicit choice before replacing an unfinished response', async () => {
  const original = draft();
  await responseDraftStore.replace(1, null, original);
  mocks.movie.mockResolvedValue({ ...film, id: 20, title: 'Another Film' });
  render(ui('/log?movieId=20'));
  const replace = await screen.findByRole('button', { name: 'Discard draft and start new' });
  await waitFor(() => expect(replace).toBeEnabled());
  expect((await responseDraftStore.read(1))?.draft).toEqual(original);
  await userEvent.click(replace);
  expect(await screen.findByRole('heading', { name: 'Another Film' })).toBeInTheDocument();
  expect(screen.getByLabelText('Note')).toHaveValue('');
  expect((await responseDraftStore.read(1))?.draft.clientRequestId).not.toBe(original.clientRequestId);
});

it('hides a previous account immediately while opening the next account draft', async () => {
  await responseDraftStore.replace(1, null, draft());
  const view = render(ui());
  await screen.findByDisplayValue('Only for me');
  mocks.ownerId = 2;
  view.rerender(ui());
  expect(screen.queryByDisplayValue('Only for me')).not.toBeInTheDocument();
  expect(await screen.findByRole('searchbox')).toBeInTheDocument();
  expect((await responseDraftStore.read(1))?.draft.note).toBe('Only for me');
});

it('keeps failed edits as drafts and removes a photo without changing saved feelings or visibility', async () => {
  const original = draft();
  mocks.response.mockResolvedValue({ user_id: 1, movie_id: 10, ...film, id: 91, title: film.title, watched_on: '2020-01-01',
    note: original.note, visibility: 'public', expression_image_path: original.expressionImage, ...original.emotions, enjoyment: original.enjoyment, highlights: original.highlights });
  mocks.update.mockRejectedValue(new Error('offline'));
  render(ui('/log?entryId=91'));
  await userEvent.click(await screen.findByRole('button', { name: 'Remove attached photo' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved');
  expect(mocks.update).toHaveBeenCalledWith(91, expect.objectContaining({ expressionImage: null, emotions: original.emotions, visibility: 'public', enjoyment: 'loved', highlights: ['performances'] }));
  expect(mocks.update.mock.calls[0][1]).not.toHaveProperty('clientRequestId');
  const stored = await responseDraftStore.read(1);
  expect(stored?.draft).toMatchObject({ editingId: 91, expressionImage: null, visibility: 'public', note: 'Only for me' });
});

it('keeps successful saves separate from discovery failure and can start another response', async () => {
  mocks.create.mockResolvedValue({ id: 91, title: film.title, visibility: 'private' });
  mocks.recommendations.mockRejectedValue(new Error('discovery unavailable'));
  render(ui('/log?movieId=10'));
  await userEvent.click(await screen.findByRole('button', { name: 'Joy' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save response' }));
  expect(await screen.findByText(/In your diary\. Only you can see it\./)).toBeInTheDocument();
  expect(await screen.findByRole('alert')).toHaveTextContent('Your response is saved');
  await userEvent.click(screen.getByRole('button', { name: 'Add another film' }));
  expect(await screen.findByRole('searchbox')).toBeInTheDocument();
  expect(mocks.create).toHaveBeenCalledTimes(1);
});

it('keeps or discards a draft through the explicit close choices', async () => {
  await responseDraftStore.replace(1, null, draft());
  const view = render(ui());
  fireEvent.change(await screen.findByLabelText('Note'), { target: { value: 'Later words' } });
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  await userEvent.click(screen.getByRole('button', { name: 'Keep draft' }));
  expect(await screen.findByText('Diary destination')).toBeInTheDocument();
  expect((await responseDraftStore.read(1))?.draft.note).toBe('Later words');
  view.unmount();
  render(ui());
  await userEvent.click(await screen.findByRole('button', { name: 'Close' }));
  await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
  expect(await screen.findByText('Diary destination')).toBeInTheDocument();
  expect(await responseDraftStore.read(1)).toBeNull();
});
