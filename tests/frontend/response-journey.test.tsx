import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Log from '../../src/pages/Log';
import DiaryEntryEditor from '../../src/components/diary/DiaryEntryEditor';
import { DiaryEntry } from '../../src/types/diary';
const mocks = vi.hoisted(() => ({ create: vi.fn(), search: vi.fn() }));
vi.mock('../../src/contexts/DiaryContext', () => ({ useDiary: () => ({ createEntry: mocks.create, savedFilms: [] }) }));
vi.mock('../../src/contexts/UserContext', () => ({ useUser: () => ({ user: { id: 1 } }) }));
vi.mock('../../src/services/suggestionService', () => ({ suggestionService: { list: async () => ({ suggestions: [], nextOffset: null }) } }));
vi.mock('../../src/services/catalogService', () => ({ catalogService: { search: mocks.search } }));
vi.mock('../../src/services/discoveryService', () => ({ discoveryService: { pulse: () => Promise.resolve([]) } }));
vi.mock('../../src/services/recommendationService', () => ({ recommendationService: { get: () => Promise.resolve({ forYou: [] }) } }));

it('finds a film without artwork and retains its note and feelings after a failed save', async () => {
  mocks.search.mockResolvedValue({ results: [{ id: 101, title: 'Shared Film', poster_path: null, release_date: '2020-01-01' }] });
  mocks.create.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ id: 1 });
  render(<MemoryRouter><Log /></MemoryRouter>);
  await userEvent.type(await screen.findByRole('searchbox'), 'Shared Film');
  await userEvent.click(screen.getByRole('button', { name: 'Search films' }));
  await userEvent.click(await screen.findByRole('button', { name: /Shared Film/ }));
  await userEvent.type(screen.getByLabelText('What did it mean to you?'), 'These words matter');
  await userEvent.click(screen.getByRole('button', { name: 'Joy' }));
  await userEvent.click(screen.getByText('Adjust intensity'));
  fireEvent.change(screen.getByRole('slider', { name: 'Joy intensity' }), { target: { value: '0.8' } });
  await userEvent.click(screen.getByRole('button', { name: 'Save response' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved');
  expect(screen.getByRole('slider', { name: 'Joy intensity' })).toHaveValue('0.8');
  expect(screen.getByLabelText('What did it mean to you?')).toHaveValue('These words matter');
  await userEvent.click(screen.getByRole('button', { name: 'Save response' }));
  expect(await screen.findByText(/is in your diary/)).toBeInTheDocument();
  expect(mocks.create).toHaveBeenLastCalledWith(expect.objectContaining({ movieId: 101, note: 'These words matter', visibility: 'private', emotions: expect.objectContaining({ happy: .8 }) }));
});

it('removes an attached photo without changing the saved feelings', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const entry = { id: 3, watched_on: '2026-07-01', note: 'A note', visibility: 'private', expression_image_path: 'data:image/png;base64,photo', neutral: 0, happy: .8, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: .2 } as DiaryEntry;
  render(<DiaryEntryEditor entry={entry} onSave={onSave} onCancel={() => undefined} />);
  await userEvent.click(screen.getByRole('checkbox', { name: 'Remove attached photo' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ expressionImage: null, emotions: expect.objectContaining({ happy: .8, surprised: .2 }) })));
});

it('lets the person reach later pages of film search results', async () => {
  mocks.search.mockResolvedValueOnce({ page: 1, total_pages: 2, results: [{ id: 1, title: 'First Film', poster_path: null }] }).mockResolvedValueOnce({ page: 2, total_pages: 2, results: [{ id: 2, title: 'Later Film', poster_path: null }] });
  render(<MemoryRouter><Log /></MemoryRouter>);
  await userEvent.type(await screen.findByRole('searchbox'), 'Film');
  await userEvent.click(screen.getByRole('button', { name: 'Search films' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Load more films' }));
  expect(await screen.findByRole('button', { name: /Later Film/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /First Film/ })).toBeInTheDocument();
  expect(mocks.search).toHaveBeenLastCalledWith('Film', 2);
});
