import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModerationSearchSchema } from '@/lib/moderationSearch';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { SanctionsPanel } from './SanctionsPanel';

describe('SanctionsPanel', () => {
  it('lists the sanctions in force, and asks for the ended ones on demand', async () => {
    useInProcessBff();
    const onSearchChange = vi.fn();
    renderWithProviders(
      <SanctionsPanel
        search={ModerationSearchSchema.parse({ tab: 'sanctions' })}
        onSearchChange={onSearchChange}
        onOpenPlayer={vi.fn()}
      />,
    );

    expect(await screen.findByText('Mute')).toBeInTheDocument();
    expect(screen.queryByText('Warning')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: /lifted and expired/ }));
    expect(onSearchChange).toHaveBeenCalledWith(expect.objectContaining({ ended: true, page: 1 }));
  });
});
