import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TwoStepDialog } from './TwoStepDialog';

const labels = { cancel: 'Cancel', back: 'Back', continue: 'Continue', confirm: 'Confirm' };
const handlers = () => ({
  onContinue: vi.fn(),
  onBack: vi.fn(),
  onCancel: vi.fn(),
  onSubmit: vi.fn((event: { preventDefault: () => void }) => event.preventDefault()),
});

describe('TwoStepDialog', () => {
  it('shows the fields, then continues when allowed', async () => {
    const on = handlers();
    render(
      <TwoStepDialog
        title="Edit"
        description="Hint"
        confirming={false}
        summary="Summary"
        canContinue
        pending={false}
        labels={labels}
        {...on}
      >
        <input aria-label="Name" />
      </TwoStepDialog>,
    );

    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(on.onContinue).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(on.onCancel).toHaveBeenCalled();
  });

  it('shows the summary, then submits or goes back', async () => {
    const on = handlers();
    render(
      <TwoStepDialog
        title="Edit"
        description="Hint"
        confirming
        summary="Rename to Haulers"
        canContinue
        pending={false}
        labels={labels}
        {...on}
      >
        <input aria-label="Name" />
      </TwoStepDialog>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Rename to Haulers');
    expect(screen.queryByRole('textbox')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(on.onSubmit).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(on.onBack).toHaveBeenCalled();
  });
});
