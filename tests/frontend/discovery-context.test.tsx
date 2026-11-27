import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { FilmVoices } from '../../src/components/paths/FilmVoices';
import { PassItOn } from '../../src/components/paths/PassItOn';
import { TieLine } from '../../src/components/paths/TieLine';
const mocks = vi.hoisted(() => ({ voices: vi.fn(), tie: vi.fn(), recipients: vi.fn() }));
vi.mock('../../src/contexts/UserContext', () => ({ useUser: () => ({ user: { id: 1, username: 'viewer' } }) }));
vi.mock('../../src/services/pathService', () => ({ pathService: mocks }));
const film = (id: number, title: string) => ({ id, title, release_date: null, poster_path: null });
const voice = (id: number, username: string, enjoyment: string | null) => ({ person: { id, username }, response: { id: id * 10, note: '', enjoyment, feelings: [] }, reason: { kind: 'following' } });
beforeEach(() => vi.clearAllMocks());

it('says on a film what the people you know made of it, grouped by verdict, each name leading to their response', async () => {
  mocks.voices.mockResolvedValue([voice(2, 'clara', 'loved'), voice(3, 'mina', 'loved'), voice(4, 'tariq', 'not_for_me'), voice(5, 'jo', null)]);
  render(<MemoryRouter><FilmVoices movieId={20} /></MemoryRouter>);
  const said = await screen.findByRole('region', { name: 'People you know' });
  expect(said).toHaveTextContent('clara and mina loved it.');
  expect(said).toHaveTextContent('tariq did not take to it.');
  expect(said).toHaveTextContent('jo wrote about it.');
  expect(screen.getByRole('link', { name: 'clara' })).toHaveAttribute('href', '/#response-20');
  expect(said.textContent).not.toMatch(/%|\d of \d/);
});

it('shows nothing on a film none of them has written about', async () => {
  mocks.voices.mockResolvedValue([]);
  const view = render(<MemoryRouter><FilmVoices movieId={20} /></MemoryRouter>);
  await vi.waitFor(() => expect(mocks.voices).toHaveBeenCalled());
  expect(view.container).toBeEmptyDOMElement();
});

it('says on a person what connects you to them, most concrete first, and opens the films in common', async () => {
  mocks.tie.mockResolvedValue({ landed: { film: film(30, 'Aftersun'), enjoyment: 'loved' }, returned: { film: film(31, 'Whiplash'), enjoyment: 'liked' }, mutuals: [{ id: 3, username: 'elena' }],
    shared: { film: film(10, 'Past Lives'), feelings: ['sad'], own_response_id: 1, their_response_id: 2, own_enjoyment: 'loved', their_enjoyment: 'loved', count: 3 } });
  const open = vi.fn();
  render(<MemoryRouter><TieLine onShared={open} username="clara" /></MemoryRouter>);
  expect(await screen.findByText(/which came from clara/)).toBeInTheDocument();
  const line = screen.getByText(/which came from clara/).closest('p')!;
  expect(line).toHaveTextContent('You loved Aftersun, which came from clara. You both felt melancholy after Past Lives. clara liked Whiplash when you sent it. elena follows them.');
  await userEvent.click(screen.getByRole('button', { name: '3 films in common' }));
  expect(open).toHaveBeenCalled();
});

it('says nothing about a person you have nothing in common with, and falls back to the shared film when the tie cannot be read', async () => {
  mocks.tie.mockResolvedValue({ shared: null, mutuals: [], landed: null, returned: null });
  const view = render(<MemoryRouter><TieLine username="stranger" /></MemoryRouter>);
  await vi.waitFor(() => expect(mocks.tie).toHaveBeenCalled());
  await vi.waitFor(() => expect(view.container).toBeEmptyDOMElement());
  view.unmount();
  mocks.tie.mockRejectedValue(new Error('offline'));
  render(<MemoryRouter><TieLine fallback="Past Lives" username="clara" /></MemoryRouter>);
  expect(await screen.findByRole('button', { name: 'Past Lives' })).toBeInTheDocument();
});

it('after a film someone enjoyed, offers only the followers there is a reason to think of, one tap from a note', async () => {
  mocks.recipients.mockResolvedValue({ wrote: [], people: [
    { id: 3, username: 'chloe', bio: '', reason: { kind: 'returned', film: film(5, 'Before Sunrise'), enjoyment: 'loved' } },
    { id: 4, username: 'plain', bio: '', reason: null }] });
  render(<MemoryRouter><PassItOn movieId={20} sourceEntryId={77} /></MemoryRouter>);
  const section = await screen.findByRole('region', { name: 'Who might like it' });
  expect(section).toHaveTextContent('Loved Before Sunrise when you sent it.');
  expect(section).not.toHaveTextContent('plain');
  expect(screen.getByRole('link', { name: 'Recommend it to chloe' })).toHaveAttribute('href', '/suggestions/new?movieId=20&recipientId=3&sourceEntryId=77');
  expect(screen.getByRole('link', { name: 'Someone else' })).toHaveAttribute('href', '/suggestions/new?movieId=20&sourceEntryId=77');
});
