import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TypedConfirmDialog } from './TypedConfirmDialog';

describe('TypedConfirmDialog', () => {
  it('allows the action once the word is typed', async () => {
    const onConfirm = vi.fn();
    render(
      <TypedConfirmDialog
        title="Delete 3 NPCs?"
        description={<p>Their accounts go too.</p>}
        word="delete"
        prompt='Type "delete" to confirm'
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Type "delete" to confirm'), 'dele');
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Type "delete" to confirm'), 'TE');
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('cancels', async () => {
    const onCancel = vi.fn();
    render(
      <TypedConfirmDialog
        title="Delete?"
        description="Gone for good."
        word="delete"
        prompt="Type it"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
