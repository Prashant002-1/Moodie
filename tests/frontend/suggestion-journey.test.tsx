import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { SuggestionReplyForm } from '../../src/components/suggestions/SuggestionReplyForm';
import { SuggestionMessages } from '../../src/components/suggestions/SuggestionMessages';
import { KeepRecommendation } from '../../src/components/suggestions/KeepRecommendation';
import { RemindMe } from '../../src/components/suggestions/RemindMe';
import { DueReminders } from '../../src/components/suggestions/DueReminders';
import { RecommendationNote } from '../../src/components/suggestions/RecommendationNote';
import SuggestionDetail from '../../src/pages/SuggestionDetail';
import SendSuggestion from '../../src/pages/SendSuggestion';
import Suggestions from '../../src/pages/Suggestions';
import Log from '../../src/pages/Log';
import { formatReminder, reminderChoices } from '../../src/types/suggestion';
import type { FilmSuggestion, SuggestionSummary } from '../../src/types/suggestion';
import type { ResponseEntry } from '../../src/services/discoveryService';

const mocks = vi.hoisted(() => ({
  filmRecipients: vi.fn(), paths: vi.fn(), list: vi.fn(), get: vi.fn(), recipients: vi.fn(), create: vi.fn(), update: vi.fn(), reply: vi.fn(), removeReply: vi.fn(),
  messages: vi.fn(), sendMessage: vi.fn(), deleteMessage: vi.fn(), response: vi.fn(), diaryPage: vi.fn(), createEntry: vi.fn(),
  savedPage: vi.fn(), unsaveFilm: vi.fn(), summary: vi.fn(),
}));
vi.mock('../../src/services/suggestionService', () => ({ suggestionService: mocks }));
vi.mock('../../src/contexts/UserContext', () => ({ useUser: () => ({ user: { id: 1, username: 'viewer' } }) }));
vi.mock('../../src/contexts/DiaryContext', () => ({ useDiary: () => ({ refresh: vi.fn(), isSaved: () => false, savedFilms: [], revision: 0, createEntry: mocks.createEntry, unsaveFilm: mocks.unsaveFilm }) }));
vi.mock('../../src/services/discoveryService', () => ({ discoveryService: { response: mocks.response, pulse: async () => [] } }));
vi.mock('../../src/services/diaryService', () => ({ diaryService: { page: mocks.diaryPage, savedPage: mocks.savedPage, status: async () => [{ id: 10, saved: false, viewing_count: 0 }] } }));
vi.mock('../../src/services/catalogService', () => ({ catalogService: { movie: async () => ({ id: 10, title: 'Scream', poster_path: null, release_date: '1996-12-20' }) } }));
vi.mock('../../src/services/pathService', () => ({ pathService: { recipients: mocks.filmRecipients, films: mocks.paths } }));

const feelings = { neutral: 0, happy: .8, sad: .1, angry: 0, fearful: .4, disgusted: 0, surprised: .5 };
const viewing: ResponseEntry = { ...feelings, id: 91, user_id: 1, movie_id: 10, title: 'Scream', username: 'viewer',
  watched_on: '2026-09-24', created_at: '2026-09-24T18:00:00Z', release_date: '1996-12-20', poster_path: null, backdrop_path: null,
  note: 'PRIVATE DIARY WORDS', visibility: 'private', expression_image_path: 'PRIVATE PHOTO', expression_image_alt: null,
  enjoyment: 'liked', highlights: ['performances'], liked: false, like_count: 0, comment_count: 0 };
const suggestion: FilmSuggestion = { id: 7, origin: 'sent', reason: 'We laughed through the scary parts together.', sender_id: 2,
  sender_username: 'ananya', recipient_id: 1, recipient_username: 'viewer', movie_id: 10, title: 'Scream', poster_path: null, backdrop_path: null,
  release_date: '1996-12-20', created_at: '2026-09-23T10:00:00Z', updated_at: '2026-09-23T10:00:00Z',
  archived: false, status: 'suggested', progress: 'sent', linked_entry_id: null, remind_at: null, source_entry_id: 15, source_note: 'Laughing through it.',
  source_feelings: feelings, reply: null, message_count: 0, conversation_open: true };
const sent: FilmSuggestion = { ...suggestion, id: 21, sender_id: 1, sender_username: 'viewer', recipient_id: 3, recipient_username: 'hiro', status: 'sent', source_entry_id: null, source_note: null, source_feelings: null };
const counts: SuggestionSummary = { received_total: 5, received_new: 2, received_saved: 1, received_to_reply: 1, reminders: 2, reminders_due: 1, sent_total: 4, sent_watched: 3, sent_replied: 2 };
const hours = (count: number) => new Date(Date.now() + count * 3_600_000).toISOString();

beforeEach(() => {
  vi.resetAllMocks();
  mocks.get.mockResolvedValue(suggestion);
  mocks.list.mockResolvedValue({ suggestions: [suggestion], nextOffset: null });
  mocks.recipients.mockResolvedValue([{ id: 2, username: 'ananya', bio: 'Films with friends' }]);
  mocks.filmRecipients.mockResolvedValue({ people: [{ id: 2, username: 'ananya', bio: 'Films with friends', reason: null }], wrote: [] });
  mocks.paths.mockResolvedValue({ films: [], nextOffset: null, total: 0, connected: true, diary: 1 });
  mocks.messages.mockResolvedValue({ messages: [], nextOffset: null });
  mocks.response.mockResolvedValue(viewing);
  mocks.diaryPage.mockResolvedValue({ entries: [viewing], nextOffset: null });
  mocks.savedPage.mockResolvedValue({ films: [], nextOffset: null });
  mocks.create.mockResolvedValue(suggestion);
  mocks.reply.mockResolvedValue({ ...suggestion, status: 'replied' });
  mocks.summary.mockResolvedValue(counts);
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
  expect(await screen.findByRole('article')).toHaveTextContent('Found through ananya');
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
  await screen.findByRole('heading', { name: /Scream/ });
  expect(mocks.list).toHaveBeenCalledTimes(1);
  expect(mocks.list.mock.calls[0][0]).toMatchObject({ box: 'received', personId: 2, limit: 30 });
  await userEvent.click(screen.getByRole('button', { name: 'More recommendations' }));
  expect(await screen.findByRole('heading', { name: /Another film/ })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Scream/ })).toBeInTheDocument();
  expect(mocks.list.mock.calls[1][0].offset).toBe(30);
});

it('opens the hub on what people recommended, with its five views and the server’s counts', async () => {
  render(<MemoryRouter initialEntries={['/suggestions']}><Suggestions /></MemoryRouter>);
  expect(screen.getByRole('heading', { level: 1, name: 'Recommendations' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Recommend a film' })).toHaveAttribute('href', '/suggestions/new');
  const group = screen.getByRole('group', { name: 'Choose recommendations view' });
  await waitFor(() => expect(within(group).getAllByRole('button').map(tab => tab.textContent)).toEqual(['For you5', 'Reminders2', 'From you4', 'Saved', 'Archived']));
  expect(within(group).getByRole('button', { name: /For you/ })).toHaveAttribute('aria-pressed', 'true');
  const numbers = screen.getByRole('group', { name: 'Recommendations in numbers' });
  expect(within(numbers).getAllByRole('link').map(stat => stat.textContent)).toEqual(['3To watch', '1To reply', '1Reminders due', '4Sent', '3Watched by them', '2Replies']);
  expect(within(numbers).getByRole('link', { name: /Reminders due/ })).toHaveAttribute('href', '/suggestions?box=reminders');
  expect(within(numbers).getByRole('link', { name: /Watched by them/ })).toHaveAttribute('href', '/suggestions?box=sent');
  const note = await screen.findByRole('article');
  expect(within(note).getByRole('link', { name: 'Scream' })).toHaveAttribute('href', '/suggestions/7');
  expect(note).toHaveTextContent('ananya thought of you');
  expect(within(note).getByText('We laughed through the scary parts together.')).toBeInTheDocument();
  expect(within(note).getByRole('link', { name: /I watched it/ })).toHaveAttribute('href', '/log?movieId=10&suggestionId=7');
  expect(within(note).getByRole('button', { name: /Remind me/ })).toBeInTheDocument();
  expect(within(note).queryByRole('list')).not.toBeInTheDocument();
  expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ box: 'received' }), expect.any(AbortSignal));
  for (const [tab, box] of [['Reminders', 'reminders'], ['From you', 'sent'], ['Archived', 'archived']]) {
    await userEvent.click(within(group).getByRole('button', { name: new RegExp(tab) }));
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ box }), expect.any(AbortSignal)));
  }
  expect(mocks.summary).toHaveBeenCalledTimes(1);
});

it('still lists recommendations when the counts cannot be loaded, and offers to retry them', async () => {
  mocks.summary.mockRejectedValueOnce(new Error('offline'));
  render(<MemoryRouter initialEntries={['/suggestions']}><Suggestions /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Counts could not be loaded.');
  expect(within(screen.getByRole('group', { name: 'Choose recommendations view' })).getAllByRole('button').map(tab => tab.textContent)).toEqual(['For you', 'Reminders', 'From you', 'Saved', 'Archived']);
  expect(await screen.findByRole('heading', { name: /Scream/ })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Retry counts' }));
  expect(await screen.findByRole('link', { name: /To watch/ })).toHaveTextContent('3');
});

it('tracks each recommendation you sent through four steps, only as far as the server says it got', async () => {
  mocks.list.mockResolvedValue({ suggestions: [sent, { ...sent, id: 22, title: 'Heat', progress: 'watched' }, { ...sent, id: 23, title: 'Ran', progress: 'replied', status: 'replied' },
    { ...sent, id: 24, title: 'Found film', origin: 'discovered', progress: 'sent', status: 'shared', source_note: 'A public response.' }], nextOffset: null });
  render(<MemoryRouter initialEntries={['/suggestions?box=sent']}><Suggestions /></MemoryRouter>);
  const steps = async (title: string) => {
    const note = (await screen.findByRole('heading', { name: new RegExp(title) })).closest('article')!;
    expect(note).toHaveTextContent(/You thought of hiro|hiro found this through you/);
    // Nothing on a note you sent offers the recipient's actions.
    expect(within(note).queryByRole('link', { name: /I watched it/ })).not.toBeInTheDocument();
    expect(within(note).queryByRole('button', { name: /Remind me/ })).not.toBeInTheDocument();
    return within(within(note).getByRole('list')).getAllByRole('listitem').map(step => [step.textContent, step.querySelector('.badge')!.classList.contains('badge--hue'), step.getAttribute('aria-current')]);
  };
  expect(await steps('Scream')).toEqual([['Sent', true, 'step'], ['Saved (not yet)', false, null], ['Watched (not yet)', false, null], ['Replied (not yet)', false, null]]);
  expect(await steps('Heat')).toEqual([['Sent', true, null], ['Saved', true, null], ['Watched', true, 'step'], ['Replied (not yet)', false, null]]);
  expect(await steps('Ran')).toEqual([['Sent', true, null], ['Saved', true, null], ['Watched', true, null], ['Replied', true, 'step']]);
  expect((await steps('Found film'))[0]).toEqual(['Found', true, 'step']);
  expect(screen.getByRole('list', { name: 'Heat: watched' })).toBeInTheDocument();
  expect(screen.queryByText('Replied', { selector: '.rec__state' })).not.toBeInTheDocument();
});

it('works out Tonight, This weekend and In a week in the person’s own time, and writes a reminder the same way everywhere', () => {
  const describe = (now: Date) => reminderChoices(now).map(choice => [choice.label, choice.at.getFullYear(), choice.at.getMonth() + 1, choice.at.getDate(), choice.at.getHours(), choice.at.getMinutes()]);
  // Monday 16 November 2026, mid-afternoon.
  expect(describe(new Date(2026, 10, 16, 15, 30))).toEqual([['Tonight', 2026, 11, 16, 20, 0], ['This weekend', 2026, 11, 21, 11, 0], ['In a week', 2026, 11, 23, 20, 0]]);
  // After eight in the evening "tonight" has gone.
  expect(describe(new Date(2026, 10, 16, 20, 0))[0]).toEqual(['Tomorrow night', 2026, 11, 17, 20, 0]);
  // Saturday before and after eleven, then Sunday before and after.
  expect(describe(new Date(2026, 10, 21, 9, 0))[1]).toEqual(['This weekend', 2026, 11, 21, 11, 0]);
  expect(describe(new Date(2026, 10, 21, 14, 0))[1]).toEqual(['This weekend', 2026, 11, 22, 11, 0]);
  expect(describe(new Date(2026, 10, 22, 9, 0))[1]).toEqual(['This weekend', 2026, 11, 22, 11, 0]);
  expect(describe(new Date(2026, 10, 22, 12, 0))[1]).toEqual(['Next weekend', 2026, 11, 28, 11, 0]);
  // Across a year end.
  expect(describe(new Date(2026, 11, 30, 23, 0))).toEqual([['Tomorrow night', 2026, 12, 31, 20, 0], ['This weekend', 2027, 1, 2, 11, 0], ['In a week', 2027, 1, 6, 20, 0]]);
  for (const choice of reminderChoices()) expect(choice.at.getTime()).toBeGreaterThan(Date.now());
  expect(formatReminder(new Date(2026, 10, 21, 11, 0))).toMatch(/^\S+ 21 \S+, 11:00$/);
  expect(formatReminder(new Date(2026, 10, 21, 9, 5))).toMatch(/, 09:05$/);
  expect(formatReminder(new Date(2026, 10, 21, 11, 0), false)).toMatch(/^\S+ 21 \S+$/);
});

it('sets a reminder from the menu, shows when it is, and changes or clears it', async () => {
  const onChange = vi.fn();
  const view = render(<RemindMe item={suggestion} onChange={onChange} />);
  const trigger = screen.getByRole('button', { name: 'Remind me about Scream' });
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('group')).not.toBeInTheDocument();
  await userEvent.click(trigger);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const menu = screen.getByRole('group', { name: 'Remind me about Scream' });
  const options = within(menu).getAllByRole('button');
  expect(options.map(option => option.textContent!.replace(/(Tonight|Tomorrow night|This weekend|Next weekend|In a week).*/, '$1'))).toEqual([reminderChoices()[0].label, reminderChoices()[1].label, 'In a week', 'Pick a time']);
  expect(options[0]).toHaveFocus();
  const when = new Date(Date.now() + 7 * 86_400_000); when.setHours(20, 0, 0, 0);
  mocks.update.mockResolvedValueOnce({ ...suggestion, remind_at: when.toISOString() });
  await userEvent.click(within(menu).getByRole('button', { name: /In a week/ }));
  expect(mocks.update).toHaveBeenCalledWith(7, { action: 'remind', remindAt: when.toISOString() });
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ remind_at: when.toISOString() }));
  await waitFor(() => expect(screen.queryByRole('group')).not.toBeInTheDocument());

  view.rerender(<RemindMe item={{ ...suggestion, remind_at: when.toISOString() }} onChange={onChange} />);
  expect(screen.getByText(formatReminder(when))).toBeInTheDocument();
  expect(screen.queryByText('Due')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Remind me about/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Change reminder about Scream' }));
  expect(screen.getByRole('group', { name: 'Remind me about Scream' })).toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('group')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Change reminder about Scream' })).toHaveFocus();
  mocks.update.mockResolvedValueOnce(suggestion);
  await userEvent.click(screen.getByRole('button', { name: 'Clear reminder about Scream' }));
  expect(mocks.update).toHaveBeenLastCalledWith(7, { action: 'clear_reminder' });
  expect(onChange).toHaveBeenLastCalledWith(suggestion);

  view.rerender(<RemindMe item={{ ...suggestion, remind_at: hours(-2) }} onChange={onChange} />);
  expect(screen.getByText('Due')).toBeInTheDocument();
});

it('moves through the reminder menu by keyboard, closes on Escape or a click outside, and keeps it open when saving fails', async () => {
  render(<><p>Elsewhere</p><RemindMe item={suggestion} onChange={vi.fn()} /></>);
  const trigger = screen.getByRole('button', { name: 'Remind me about Scream' });
  trigger.focus();
  await userEvent.keyboard('{Enter}');
  const options = () => within(screen.getByRole('group')).getAllByRole('button');
  expect(options()[0]).toHaveFocus();
  await userEvent.keyboard('{ArrowDown}{ArrowDown}');
  expect(options()[2]).toHaveFocus();
  await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
  expect(options()[3]).toHaveFocus();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('group')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  await userEvent.click(trigger);
  expect(screen.getByRole('group')).toBeInTheDocument();
  await userEvent.click(screen.getByText('Elsewhere'));
  expect(screen.queryByRole('group')).not.toBeInTheDocument();
  await userEvent.click(trigger);
  mocks.update.mockRejectedValueOnce(new Error('offline'));
  await userEvent.click(options()[0]);
  expect(await screen.findByRole('alert')).toHaveTextContent('The reminder could not be saved. Try again.');
  expect(screen.getByRole('group')).toBeInTheDocument();
});

it('takes a picked time in local time, and refuses one that has passed before asking the server', async () => {
  const onChange = vi.fn();
  render(<RemindMe item={suggestion} onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: 'Remind me about Scream' }));
  await userEvent.click(screen.getByRole('button', { name: 'Pick a time' }));
  const field = screen.getByLabelText('Pick a time');
  expect(field).toHaveAttribute('type', 'datetime-local');
  expect(field).toHaveFocus();
  fireEvent.change(field, { target: { value: '2020-01-01T10:00' } });
  await userEvent.click(screen.getByRole('button', { name: 'Set reminder' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Choose a time in the future.');
  fireEvent.change(field, { target: { value: `${new Date().getFullYear() + 2}-01-01T10:00` } });
  await userEvent.click(screen.getByRole('button', { name: 'Set reminder' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Choose a time within the next year.');
  expect(mocks.update).not.toHaveBeenCalled();
  const future = new Date(Date.now() + 40 * 86_400_000); future.setHours(19, 45, 0, 0);
  const local = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}T19:45`;
  fireEvent.change(field, { target: { value: local } });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  mocks.update.mockResolvedValueOnce({ ...suggestion, remind_at: future.toISOString() });
  await userEvent.click(screen.getByRole('button', { name: 'Set reminder' }));
  expect(mocks.update).toHaveBeenCalledWith(7, { action: 'remind', remindAt: future.toISOString() });
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ remind_at: future.toISOString() }));
});

it('shows only reminders that have come due on home, each with I watched it and Later, and nothing when none are', async () => {
  const due = { ...suggestion, remind_at: hours(-3) }, ahead = { ...suggestion, id: 8, title: 'Not yet', remind_at: hours(30) };
  mocks.list.mockResolvedValue({ suggestions: [due, ahead], nextOffset: null });
  render(<MemoryRouter><DueReminders /></MemoryRouter>);
  const section = await screen.findByRole('region', { name: 'Reminders' });
  expect(mocks.list).toHaveBeenCalledWith({ box: 'reminders', limit: 12 }, expect.any(AbortSignal));
  expect(within(section).getByRole('heading', { level: 2, name: 'Reminders' })).toBeInTheDocument();
  expect(within(section).getByRole('link', { name: 'See all reminders' })).toHaveAttribute('href', '/suggestions?box=reminders');
  expect(within(section).getAllByRole('article')).toHaveLength(1);
  expect(within(section).queryByText('Not yet')).not.toBeInTheDocument();
  const note = within(section).getByRole('article');
  expect(note).toHaveTextContent('ananya thought of you');
  expect(within(note).getByText('Due')).toBeInTheDocument();
  expect(within(note).getByRole('link', { name: /I watched it/ })).toHaveAttribute('href', '/log?movieId=10&suggestionId=7');
  const moved = hours(48);
  mocks.update.mockResolvedValueOnce({ ...suggestion, remind_at: moved });
  await userEvent.click(within(note).getByRole('button', { name: /^Later/ }));
  const menu = screen.getByRole('group', { name: 'Remind me about Scream' });
  expect(within(menu).getByRole('button', { name: 'Clear reminder' })).toBeInTheDocument();
  await userEvent.click(within(menu).getAllByRole('button')[0]);
  expect(mocks.update).toHaveBeenCalledWith(7, expect.objectContaining({ action: 'remind' }));
  await waitFor(() => expect(screen.queryByRole('article')).not.toBeInTheDocument());
  expect(screen.getByRole('status')).toHaveTextContent(`Reminder moved to ${formatReminder(moved)}.`);
});

it('renders nothing on home when no reminder is due', async () => {
  mocks.list.mockResolvedValue({ suggestions: [{ ...suggestion, remind_at: hours(30) }], nextOffset: null });
  const view = render(<MemoryRouter><DueReminders /></MemoryRouter>);
  await waitFor(() => expect(mocks.list).toHaveBeenCalled());
  await waitFor(() => expect(view.container).toBeEmptyDOMElement());
});

it('shows a note with its reminder, and keeps it off a note you sent', async () => {
  const reminded = { ...suggestion, backdrop_path: '/wide.jpg', remind_at: hours(30) };
  const view = render(<MemoryRouter><RecommendationNote item={reminded} viewerId={1} /></MemoryRouter>);
  expect(screen.getByText(formatReminder(reminded.remind_at))).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Change reminder about Scream' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open Scream' })).toHaveAttribute('href', '/suggestions/7');
  // The small note says it in one line: the day, or Due once the time has passed.
  view.rerender(<MemoryRouter><RecommendationNote compact item={reminded} viewerId={1} /></MemoryRouter>);
  expect(screen.getByText(formatReminder(reminded.remind_at, false))).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  view.rerender(<MemoryRouter><RecommendationNote compact item={{ ...reminded, remind_at: hours(-1) }} viewerId={1} /></MemoryRouter>);
  expect(screen.getByText('Due')).toHaveClass('badge--accent');
  // A recommendation that has been watched has no reminder to offer: the next step is the reply.
  view.rerender(<MemoryRouter><RecommendationNote item={{ ...suggestion, status: 'watched', progress: 'watched', linked_entry_id: 91 }} viewerId={1} /></MemoryRouter>);
  expect(screen.queryByRole('button', { name: /Remind me/ })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /^Reply/ })).toHaveAttribute('href', '/suggestions/7');
});

it('sets a reminder from the recommendation’s own page and offers none once it is archived or watched', async () => {
  const when = hours(26);
  mocks.update.mockResolvedValueOnce({ ...suggestion, remind_at: when });
  const view = render(<MemoryRouter initialEntries={['/suggestions/7']}><Routes><Route path="/suggestions/:id" element={<SuggestionDetail />} /></Routes></MemoryRouter>);
  expect(await screen.findByRole('heading', { level: 1, name: /Scream/ })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Recommendations' })).toHaveAttribute('href', '/suggestions');
  expect(screen.getByRole('link', { name: 'I watched it' })).toHaveAttribute('href', '/log?movieId=10&suggestionId=7');
  await userEvent.click(screen.getByRole('button', { name: 'Remind me about Scream' }));
  await userEvent.click(within(screen.getByRole('group', { name: 'Remind me about Scream' })).getAllByRole('button')[0]);
  expect(mocks.update).toHaveBeenCalledWith(7, expect.objectContaining({ action: 'remind', remindAt: expect.any(String) }));
  expect(await screen.findByText(formatReminder(when))).toBeInTheDocument();
  view.unmount();
  mocks.get.mockResolvedValue({ ...suggestion, archived: true });
  render(<MemoryRouter initialEntries={['/suggestions/7']}><Routes><Route path="/suggestions/:id" element={<SuggestionDetail />} /></Routes></MemoryRouter>);
  expect(await screen.findByText('Archived')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Remind me/ })).not.toBeInTheDocument();
});

it('shows the sender what happened to a recommendation on its page, with their reply in their own words and none of the recipient’s actions', async () => {
  mocks.get.mockResolvedValue({ ...sent, id: 7, status: 'replied', progress: 'replied', reply: { enjoyment: 'loved', highlights: ['ending'], note: 'You were right.', feelings: null, contains_spoilers: false, created_at: '2026-09-25T10:00:00Z', updated_at: '2026-09-25T10:00:00Z' } });
  const view = render(<MemoryRouter initialEntries={['/suggestions/7']}><Routes><Route path="/suggestions/:id" element={<SuggestionDetail />} /></Routes></MemoryRouter>);
  expect(await screen.findByRole('list', { name: 'Scream: replied' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'hiro’s reply' })).toBeInTheDocument();
  const words = screen.getByText('You were right.');
  expect(words.tagName).toBe('BLOCKQUOTE');
  expect(words).toHaveClass('quote');
  expect(screen.queryByRole('region', { name: 'Your viewing' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Remind me/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'I watched it' })).not.toBeInTheDocument();
  expect(view.container.querySelector('.band')).not.toBeNull();
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
  expect(within(saved).getByRole('link', { name: 'Log Saved old film' })).toHaveAttribute('href', '/log?movieId=102');
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
  await userEvent.click(screen.getByRole('button', { name: 'Save for later' }));
  expect(mocks.create).toHaveBeenCalledWith({ origin: 'discovered', sourceEntryId: 15 });
});

it('preserves the chosen person and reason when a deliberate recommendation fails', async () => {
  mocks.create.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(suggestion);
  render(<MemoryRouter initialEntries={['/suggestions/new?movieId=10']}><Routes><Route path="/suggestions/new" element={<SendSuggestion />} /><Route path="/suggestions/:id" element={<p>Sent destination</p>} /></Routes></MemoryRouter>);
  await userEvent.click(await screen.findByRole('button', { name: /ananya Films with friends/ }));
  // The note is shown as the other person will receive it, and follows the words as they are written.
  const preview = screen.getByRole('region', { name: 'Preview' });
  expect(within(preview).getByText('What ananya will receive')).toBeInTheDocument();
  expect(within(preview).getByRole('article')).toHaveTextContent('viewer thought of you');
  expect(within(preview).getByRole('heading', { name: /Scream/ })).toBeInTheDocument();
  expect(within(preview).queryByRole('link')).not.toBeInTheDocument();
  expect(within(preview).queryByRole('button')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send recommendation' })).toBeDisabled();
  await userEvent.type(screen.getByLabelText('Why this film for them?'), 'You will laugh through the scary parts.');
  expect(within(preview).getByText('You will laugh through the scary parts.').tagName).toBe('BLOCKQUOTE');
  await userEvent.click(screen.getByRole('button', { name: 'Send recommendation' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.getByLabelText('Why this film for them?')).toHaveValue('You will laugh through the scary parts.');
  await userEvent.click(screen.getByRole('button', { name: 'Send recommendation' }));
  expect(await screen.findByText('Sent destination')).toBeInTheDocument();
  expect(mocks.create).toHaveBeenLastCalledWith({ origin: 'sent', movieId: 10, recipientId: 2, reason: 'You will laugh through the scary parts.' });
});

it('offers first the followers a film suits, each with the reason, and says who has already written about it', async () => {
  mocks.filmRecipients.mockResolvedValue({ wrote: [{ id: 9, username: 'hiro' }], people: [
    { id: 3, username: 'chloe', bio: 'Animated robots', reason: { kind: 'returned', film: { id: 5, title: 'Before Sunrise', release_date: null, poster_path: null }, enjoyment: 'loved' } },
    { id: 2, username: 'ananya', bio: 'Films with friends', reason: null }] });
  render(<MemoryRouter initialEntries={['/suggestions/new?movieId=10']}><Routes><Route path="/suggestions/new" element={<SendSuggestion />} /></Routes></MemoryRouter>);
  const first = await screen.findByRole('button', { name: /chloe/ });
  expect(first).toHaveTextContent('Loved Before Sunrise when you sent it.');
  expect(first).not.toHaveTextContent('Animated robots');
  expect(screen.getByRole('button', { name: /ananya Films with friends/ })).toBeInTheDocument();
  expect(screen.getByText('hiro has already written about it.')).toBeInTheDocument();
  expect(mocks.filmRecipients).toHaveBeenCalledWith(10, '', expect.any(AbortSignal));
  await userEvent.click(first);
  expect(screen.getByText('What chloe will receive')).toBeInTheDocument();
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
