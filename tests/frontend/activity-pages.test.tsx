import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Activity from '../../src/pages/Activity';
const mocks = vi.hoisted(() => ({ activity: vi.fn(), feed: vi.fn() }));
vi.mock('../../src/contexts/UserContext', () => ({ useUser: () => ({ user: { id: 1 } }) }));
vi.mock('../../src/contexts/DiaryContext', () => ({ useDiary: () => ({ revision: 0 }) }));
vi.mock('../../src/services/discoveryService', () => ({ discoveryService: { activityPage: mocks.activity, feedPage: mocks.feed } }));
const event = { event_id: 'like:11:2', kind: 'like', actor_id: 2, username: 'friend', title: 'A Film', entry_id: 11, movie_id: 101, suggestion_id: null, created_at: '2026-01-01', comment_body: null, note: 'Original response' };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.activity.mockResolvedValue({ activity: [event], nextOffset: null });
  mocks.feed.mockResolvedValue({ entries: [], nextCursor: null });
});
it('opens exact response and conversation destinations and keeps same-time messages distinct', async () => {
  mocks.activity.mockResolvedValue({ activity: [event,
    { ...event, kind: 'suggestion_message', event_id: 'suggestion_message:1', entry_id: null, suggestion_id: 7, comment_body: 'One message' },
    { ...event, kind: 'suggestion_message', event_id: 'suggestion_message:2', entry_id: null, suggestion_id: 7, comment_body: 'Another message' },
    { ...event, kind: 'suggestion_reply', event_id: 'suggestion_reply:7', entry_id: null, suggestion_id: 7, comment_body: null },
  ], nextOffset: null });
  render(<MemoryRouter><Activity /></MemoryRouter>);
  expect(await screen.findByRole('link', { name: 'liked your response to A Film' })).toHaveAttribute('href', '/response/11');
  expect(screen.getByRole('link', { name: 'told you how A Film landed' })).toHaveAttribute('href', '/suggestions/7');
  expect(screen.getAllByRole('link', { name: 'continued your conversation about A Film' })).toHaveLength(2);
  expect(screen.getByText('One message')).toBeInTheDocument();
  expect(screen.getByText('Another message')).toBeInTheDocument();
  expect(screen.queryByText('Original response')).not.toBeInTheDocument();
});
it('loads one activity page, preserves it when the circle fails, and explicitly appends an older page', async () => {
  mocks.feed.mockRejectedValue(new Error('offline'));
  mocks.activity.mockResolvedValueOnce({ activity: [event], nextOffset: 40 }).mockResolvedValueOnce({ activity: [{ ...event, event_id: 'follow:2:1', kind: 'follow', entry_id: null }], nextOffset: null });
  render(<MemoryRouter><Activity /></MemoryRouter>);
  await screen.findByRole('link', { name: 'liked your response to A Film' });
  expect(mocks.activity).toHaveBeenCalledTimes(1);
  expect(await screen.findByRole('button', { name: 'Retry circle' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Earlier activity' }));
  expect(await screen.findByRole('link', { name: 'followed you' })).toHaveAttribute('href', '/member/friend');
  expect(mocks.activity).toHaveBeenLastCalledWith({ limit: 40, offset: 40, kind: 'all' }, expect.any(AbortSignal));
  expect(mocks.feed).toHaveBeenCalledWith({ scope: 'following', limit: 6 }, expect.any(AbortSignal));
});
it('requests filters from the server and hides previous results before the new query resolves', async () => {
  render(<MemoryRouter><Activity /></MemoryRouter>);
  await screen.findByRole('link', { name: 'liked your response to A Film' });
  mocks.activity.mockReturnValueOnce(new Promise(() => undefined));
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter activity' }), 'recommendations');
  expect(screen.queryByRole('link', { name: 'liked your response to A Film' })).not.toBeInTheDocument();
  await waitFor(() => expect(mocks.activity).toHaveBeenLastCalledWith({ limit: 40, offset: undefined, kind: 'recommendations' }, expect.any(AbortSignal)));
});
