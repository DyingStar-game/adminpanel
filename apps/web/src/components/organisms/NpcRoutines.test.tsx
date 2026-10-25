import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { NpcRoutines } from './NpcRoutines';

describe('NpcRoutines', () => {
  it('lists the patterns and opens the one picked in the editor', async () => {
    useInProcessBff();
    const onPatternChange = vi.fn();
    const { unmount } = renderWithProviders(
      <NpcRoutines pattern={undefined} onPatternChange={onPatternChange} />,
    );

    const table = await screen.findByRole('table', { name: 'Shift patterns' });
    await userEvent.click(await within(table).findByRole('row', { name: /magasinier_2/ }));
    expect(onPatternChange).toHaveBeenCalledWith('magasinier_2');
    expect(screen.queryByRole('form', { name: /^Pattern/ })).not.toBeInTheDocument();
    unmount();

    // The URL now names it.
    renderWithProviders(<NpcRoutines pattern="magasinier_2" onPatternChange={onPatternChange} />);
    expect(await screen.findByRole('form', { name: 'Pattern magasinier_2' })).toBeInTheDocument();
    expect(
      await screen.findByRole('form', { name: 'Activities and their actions' }),
    ).toBeInTheDocument();
  });

  it('starts a new pattern and opens the import', async () => {
    useInProcessBff();
    renderWithProviders(<NpcRoutines pattern={undefined} onPatternChange={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: 'New pattern' }));
    const editor = await screen.findByRole('form', { name: 'New pattern' });
    expect(within(editor).getByLabelText('Name')).toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: 'Import schedules.yaml' }));
    expect(screen.getByRole('dialog', { name: 'Import schedules' })).toBeInTheDocument();
  });
});
