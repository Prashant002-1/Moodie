import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ConfirmProvider } from '../../src/components/common/Confirm';
import { useConfirm } from '../../src/hooks/useConfirm';

// Before something that cannot be taken back, Moodie asks in the page, in its own words.
function Delete({ onDelete }: { onDelete: () => void }) {
  const confirm = useConfirm();
  return <button onClick={async () => { if (await confirm({ title: 'Delete this viewing?', body: 'Any reply linked to it is removed too.', action: 'Delete' })) onDelete(); }}>Delete viewing</button>;
}

it('asks in the page, starts on the safe answer, and goes ahead only when told to', async () => {
  const onDelete = vi.fn();
  const native = vi.spyOn(window, 'confirm');
  render(<ConfirmProvider><Delete onDelete={onDelete} /></ConfirmProvider>);
  const opener = screen.getByRole('button', { name: 'Delete viewing' });

  await userEvent.click(opener);
  const dialog = screen.getByRole('alertdialog', { name: 'Delete this viewing?' });
  expect(dialog).toHaveAccessibleDescription('Any reply linked to it is removed too.');
  expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
  // Tab stays inside the question.
  await userEvent.tab();
  expect(within(dialog).getByRole('button', { name: 'Delete' })).toHaveFocus();
  await userEvent.tab();
  expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
  // Escape is "no", and focus returns to where the person was.
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(onDelete).not.toHaveBeenCalled();
  expect(opener).toHaveFocus();

  await userEvent.click(opener);
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
  expect(onDelete).not.toHaveBeenCalled();

  await userEvent.click(opener);
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(native).not.toHaveBeenCalled();
});
