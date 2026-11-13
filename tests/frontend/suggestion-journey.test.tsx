import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { SuggestionReplyForm } from '../../src/components/suggestions/SuggestionReplyForm';
import { SuggestionMessages } from '../../src/components/suggestions/SuggestionMessages';
import { KeepRecommendation } from '../../src/components/suggestions/KeepRecommendation';
import SuggestionDetail from '../../src/pages/SuggestionDetail';
import SendSuggestion from '../../src/pages/SendSuggestion';
import Suggestions from '../../src/pages/Suggestions';
import Log from '../../src/pages/Log';
import type { FilmSuggestion } from '../../src/types/suggestion';
import type { ResponseEntry } from '../../src/services/discoveryService';

const mocks = vi.hoisted(() => ({
  list: vi.fn(), get: vi.fn(), recipients: vi.fn(), create: vi.fn(), update: vi.fn(), reply: vi.fn(), removeReply: vi.fn(),
  messages: vi.fn(), sendMessage: vi.fn(), deleteMessage: vi.fn(), response: vi.fn(), diaryPage: vi.fn(), createEntry: vi.fn(),
  savedPage: vi.fn(), unsaveFilm: vi.fn(),
}));
vi.mock('../../src/services/suggestionService', () => ({ suggestionService: mocks }));
vi.mock('../../src/contexts/UserContext', () => ({ useUser: () => ({ user: { id: 1, username: 'viewer' } }) }));
vi.mock('../../src/contexts/DiaryContext', () => ({ useDiary: () => ({ refresh: vi.fn(), isSaved: () => false, savedFilms: [], revision: 0, createEntry: mocks.createEntry, unsaveFilm: mocks.unsaveFilm }) }));
vi.mock('../../src/services/discoveryService', () => ({ discoveryService: { response: mocks.response, pulse: async () => [] } }));
vi.mock('../../src/services/diaryService', () => ({ diaryService: { page: mocks.diaryPage, savedPage: mocks.savedPage, status: async () => [{ id: 10, saved: false, viewing_count: 0 }] } }));
vi.mock('../../src/services/catalogService', () => ({ catalogService: { movie: async () => ({ id: 10, title: 'Scream', poster_path: null, release_date: '1996-12-20' }) } }));
vi.mock('../../src/services/recommendationService', () => ({ recommendationService: { get: async () => ({ forYou: [] }) } }));

const feelings = { neutral: 0, happy: .8, sad: .1, angry: 0, fearful: .4, disgusted: 0, surprised: .5 };
const viewing: ResponseEntry = { ...feelings, id: 91, user_id: 1, movie_id: 10, title: 'Scream', username: 'viewer',
  watched_on: '2026-09-24', created_at: '2026-09-24T18:00:00Z', release_date: '1996-12-20', poster_path: null, backdrop_path: null,
  note: 'PRIVATE DIARY WORDS', visibility: 'private', expression_image_path: 'PRIVATE PHOTO', expression_image_alt: null,
  enjoyment: 'liked', highlights: ['performances'], liked: false, like_count: 0, comment_count: 0 };
const suggestion: FilmSuggestion = { id: 7, origin: 'sent', reason: 'We laughed through the scary parts together.', sender_id: 2,
  sender_username: 'ananya', recipient_id: 1, recipient_username: 'viewer', movie_id: 10, title: 'Scream', poster_path: null,
  release_date: '1996-12-20', created_at: '2026-09-23T10:00:00Z', updated_at: '2026-09-23T10:00:00Z',
  archived: false, status: 'suggested', linked_entry_id: null, source_entry_id: 15, source_note: 'Laughing through it.',
  source_feelings: feelings, reply: null, message_count: 0, conversation_open: true };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.get.mockResolvedValue(suggestion);
  mocks.list.mockResolvedValue({ suggestions: [suggestion], nextOffset: null });
  mocks.recipients.mockResolvedValue([{ id: 2, username: 'ananya', bio: 'Films with friends' }]);
  mocks.messages.mockResolvedValue({ messages: [], nextOffset: null });
  mocks.response.mockResolvedValue(viewing);
  mocks.diaryPage.mockResolvedValue({ entries: [viewing], nextOffset: null });
  mocks.savedPage.mockResolvedValue({ films: [], nextOffset: null });
  mocks.create.mockResolvedValue(suggestion);
  mocks.reply.mockResolvedValue({ ...suggestion, status: 'replied' });
});

it('starts a separate reply without diary words or photos and shares feelings only after an explicit choice', async () => {
  const onSaved = vi.fn();
  render(<SuggestionReplyForm item={suggestion} viewing={viewing} onSaved={onSaved} onCancel={vi.fn()} />);
  expect(screen.getByLabelText('Tell them what you thought')).toHaveValue('');
  expect(screen.queryByText('PRIVATE DIARY WORDS')).not.toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Include my feelings')).not.toBeChecked();
  await userEvent.type(screen.getByLabelText('Tell them what you thought'), 'You were right about laughing.');
  await userEvent.click(screen.getByText('Preview reply'));
  expect(within(screen.getByText('Preview reply').parentElement!).getByText('You were right about laughing.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Send reply' }));
  expect(mocks.reply).toHaveBeenCalledWith(7, { entryId: 91, enjoyment: 'liked', highlights: ['performances'], note: 'You were right about laughing.', shareFeelings: false, containsSpoilers: false });
  expect(onSaved).toHaveBeenCalled();
});

it('retains the written reply and all consent choices after a failed send', async () => {
  mocks.reply.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(suggestion);
  render(<SuggestionReplyForm item={suggestion} viewing={viewing} onSaved={vi.fn()} onCancel={vi.fn()} />);
  await userEvent.type(screen.getByLabelText('Tell them what you thought'), 'An ending I loved.');
  await userEvent.click(screen.getByLabelText('Include my feelings'));
  await userEvent.click(screen.getByLabelText('Contains spoilers'));
  await userEvent.click(screen.getByRole('button', { name: 'Send reply' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.getByLabelText('Tell them what you thought')).toHaveValue('An ending I loved.');
  expect(screen.getByLabelText('Include my feelings')).toBeChecked();
  await userEvent.click(screen.getByRole('button', { name: 'Send reply' }));
  expect(mocks.reply).toHaveBeenLastCalledWith(7, expect.objectContaining({ shareFeelings: true, containsSpoilers: true, note: 'An ending I loved.' }));
});

it('reuses a message request ID on retry and gives changed text a new identity', async () => {
  mocks.sendMessage.mockRejectedValueOnce(new Error('connection lost')).mockResolvedValue(undefined);
  render(<MemoryRouter><SuggestionMessages id={7} viewerId={1} onRevoked={vi.fn()} /></MemoryRouter>);
  await userEvent.type(screen.getByLabelText('Talk about the film'), 'I finally watched it!');
  await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  const first = mocks.sendMessage.mock.calls[0][1];
  await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
  expect(mocks.sendMessage.mock.calls[1][1]).toEqual(first);
  expect(await screen.findByText('Message sent.')).toBeInTheDocument();
  expect(screen.getByLabelText('Talk about the film')).toHaveValue('');
  await userEvent.type(screen.getByLabelText('Talk about the film'), 'The ending stayed with me.');
  await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
  expect(mocks.sendMessage.mock.calls[2][1].clientRequestId).not.toBe(first.clientRequestId);
});

it('hides spoiler messages and never offers to delete another person’s message', async () => {
  mocks.messages.mockResolvedValue({ messages: [{ id: 1, user_id: 2, username: 'ananya', body: 'THE SPOILER', contains_spoilers: true, created_at: '2026-09-24T18:00:00Z' }], nextOffset: null });
  render(<MemoryRouter><SuggestionMessages id={7} viewerId={1} onRevoked={vi.fn()} /></MemoryRouter>);
  await screen.findByRole('button', { name: 'Show spoilers' });
  expect(screen.queryByText('THE SPOILER')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Delete your/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Show spoilers' }));
  expect(screen.getByText('THE SPOILER')).toBeInTheDocument();
});

it('links an existing private viewing, then opens an intentionally separate reply', async () => {
  mocks.update.mockResolvedValue({ ...suggestion, linked_entry_id: 91, status: 'watched' });
  render(<MemoryRouter initialEntries={['/suggestions/7']}><Routes><Route path="/suggestions/:id" element={<SuggestionDetail />} /></Routes></MemoryRouter>);
  await userEvent.click(await screen.findByRole('button', { name: 'Link an existing viewing' }));
  await userEvent.click(await screen.findByRole('button', { name: /PRIVATE DIARY WORDS/ }));
  expect(mocks.update).toHaveBeenCalledWith(7, { action: 'link', entryId: 91 });
  await userEvent.click(await screen.findByRole('button', { name: 'Tell ananya how it landed' }));
  expect(await screen.findByLabelText('Tell them what you thought')).toHaveValue('');
  expect(screen.queryByText('PRIVATE DIARY WORDS')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Their response' })).toHaveAttribute('href', '/response/15');
});

it('keeps discovery private before the first reply and preserves conversation access after retraction', async () => {
  mocks.get.mockResolvedValue({ ...suggestion, origin: 'discovered', reason: '', status: 'saved', conversation_open: false });
  render(<MemoryRouter initialEntries={['/suggestions/7']}><Routes><Route path="/suggestions/:id" element={<SuggestionDetail />} /></Routes></MemoryRouter>);
  expect(await screen.findByText('Found through ananya')).toBeInTheDocument();
  expect(screen.getByText('Kept from their response. Only you can see this.')).toBeInTheDocument();
  expect(screen.queryByLabelText('Talk about the film')).not.toBeInTheDocument();
  expect(mocks.messages).not.toHaveBeenCalled();
  mocks.get.mockResolvedValue({ ...suggestion, origin: 'discovered', reply: null, conversation_open: true, status: 'watched', linked_entry_id: 91 });
  await userEvent.click(screen.getByRole('button', { name: 'Refresh', exact: true }));
  expect(await screen.findByLabelText('Talk about the film')).toBeInTheDocument();
});

it('pages the inbox explicitly and sends filters to the server', async () => {
  mocks.list.mockResolvedValueOnce({ suggestions: [suggestion], nextOffset: 30 }).mockResolvedValueOnce({ suggestions: [{ ...suggestion, id: 8, title: 'Another film' }], nextOffset: null });
  render(<MemoryRouter initialEntries={['/suggestions?personId=2']}><Suggestions /></MemoryRouter>);
  await screen.findByRole('link', { name: /Scream/ });
  expect(mocks.list).toHaveBeenCalledTimes(1);
  expect(mocks.list.mock.calls[0][0]).toMatchObject({ box: 'received', personId: 2, limit: 30 });
  await userEvent.click(screen.getByRole('button', { name: 'More recommendations' }));
  expect(await screen.findByRole('link', { name: /Another film/ })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Scream/ })).toBeInTheDocument();
  expect(mocks.list.mock.calls[1][0].offset).toBe(30);
});

it('opens the watchlist on recommendations from people and names its four views', async () => {
  render(<MemoryRouter initialEntries={['/suggestions']}><Suggestions /></MemoryRouter>);
  expect(screen.getByRole('heading', { level: 1, name: 'Watchlist' })).toBeInTheDocument();
  const tabs = within(screen.getByRole('group', { name: 'Choose watchlist view' })).getAllByRole('button');
  expect(tabs.map(tab => tab.textContent)).toEqual(['From people', 'Saved', 'Sent', 'Archived']);
  expect(screen.getByRole('button', { name: 'From people' })).toHaveAttribute('aria-pressed', 'true');
  const row = await screen.findByRole('link', { name: /Scream/ });
  expect(row).toHaveAttribute('href', '/suggestions/7');
  expect(within(row).getByText('ananya thought of you')).toBeInTheDocument();
  expect(within(row).getByText('We laughed through the scary parts together.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Sent' }));
  await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ box: 'sent' }), expect.any(AbortSignal)));
});

it('shows saved films in their own view without asking the recommendations service for them', async () => {
  mocks.savedPage.mockResolvedValueOnce({ films: [{ id: 41, movie_id: 102, title: 'Saved old film', poster_path: null, release_date: '1999-01-01' }], nextOffset: 30 })
    .mockResolvedValueOnce({ films: [{ id: 40, movie_id: 103, title: 'Another saved film', poster_path: null, release_date: null }], nextOffset: null })
    .mockResolvedValue({ films: [], nextOffset: null });
  render(<MemoryRouter initialEntries={['/suggestions?box=saved']}><Suggestions /></MemoryRouter>);
  expect(screen.getByRole('button', { name: 'Saved' })).toHaveAttribute('aria-pressed', 'true');
  const saved = await screen.findByRole('region', { name: 'Saved films' });
  expect(await within(saved).findByRole('heading', { name: 'Saved old film' })).toBeInTheDocument();
  expect(within(saved).getByRole('link', { name: 'Saved old film' })).toHaveAttribute('href', '/movie/102');
  expect(within(saved).getByRole('link', { name: 'Add response' })).toHaveAttribute('href', '/log?movieId=102');
  expect(within(saved).getByRole('link', { name: 'Who recommended it' })).toHaveAttribute('href', '/suggestions?movieId=102');
  expect(mocks.list).not.toHaveBeenCalled();
  await userEvent.click(within(saved).getByRole('button', { name: 'More saved films' }));
  expect(await within(saved).findByRole('heading', { name: 'Another saved film' })).toBeInTheDocument();
  expect(mocks.savedPage).toHaveBeenLastCalledWith({ q: undefined, limit: 30, offset: 30 }, expect.any(AbortSignal));
  await userEvent.click(within(saved).getAllByRole('button', { name: 'Remove from saved' })[0]);
  expect(mocks.unsaveFilm).toHaveBeenCalledWith(102);
  await userEvent.type(within(saved).getByLabelText('Search saved films'), 'nothing here');
  await userEvent.click(within(saved).getByRole('button', { name: 'Search saved' }));
  expect(await within(saved).findByText('No saved films match.')).toBeInTheDocument();
  expect(mocks.savedPage).toHaveBeenLastCalledWith({ q: 'nothing here', limit: 30, offset: undefined }, expect.any(AbortSignal));
  expect(mocks.list).not.toHaveBeenCalled();
});

it('keeps the exact source response without inventing an authored recommendation', async () => {
  render(<MemoryRouter><KeepRecommendation entryId={15} authorId={2} movieId={10} /></MemoryRouter>);
  await userEvent.click(screen.getByRole('button', { name: 'Add to watchlist' }));
  expect(mocks.create).toHaveBeenCalledWith({ origin: 'discovered', sourceEntryId: 15 });
});

it('preserves the chosen person and reason when a deliberate recommendation fails', async () => {
  mocks.create.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(suggestion);
  render(<MemoryRouter initialEntries={['/suggestions/new?movieId=10']}><Routes><Route path="/suggestions/new" element={<SendSuggestion />} /><Route path="/suggestions/:id" element={<p>Sent destination</p>} /></Routes></MemoryRouter>);
  await userEvent.click(await screen.findByRole('button', { name: /ananya Films with friends/ }));
  await userEvent.type(screen.getByLabelText('Why this film for them?'), 'You will laugh through the scary parts.');
  await userEvent.click(screen.getByRole('button', { name: 'Send recommendation' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.getByLabelText('Why this film for them?')).toHaveValue('You will laugh through the scary parts.');
  await userEvent.click(screen.getByRole('button', { name: 'Send recommendation' }));
  expect(await screen.findByText('Sent destination')).toBeInTheDocument();
  expect(mocks.create).toHaveBeenLastCalledWith({ origin: 'sent', movieId: 10, recipientId: 2, reason: 'You will laugh through the scary parts.' });
});

it('records attribution and enjoyment in the diary write and offers a reply without sending one automatically', async () => {
  mocks.createEntry.mockResolvedValue({ ...viewing, enjoyment: 'loved' });
  render(<MemoryRouter initialEntries={['/log?movieId=10&suggestionId=7']}><Log /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Scream' });
  await waitFor(() => expect(screen.getByLabelText('Recommended by')).toHaveValue('7'));
  await userEvent.type(screen.getByLabelText('Note'), 'PRIVATE DIARY WORDS');
  await userEvent.click(screen.getByRole('button', { name: 'Loved it' }));
  await userEvent.click(screen.getByRole('button', { name: 'Joy' }));
  expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Save response' }));
  expect(await screen.findByRole('link', { name: 'Reply to ananya' })).toHaveAttribute('href', '/suggestions/7');
  expect(mocks.createEntry).toHaveBeenCalledWith(expect.objectContaining({ movieId: 10, suggestionId: 7, enjoyment: 'loved', note: 'PRIVATE DIARY WORDS', visibility: 'private', clientRequestId: expect.any(String) }));
  expect(mocks.reply).not.toHaveBeenCalled();
  expect(screen.getByRole('link', { name: 'Read your response' })).toHaveAttribute('href', '/response/91');
});
