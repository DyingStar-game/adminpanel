import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSocialDataset, socialIds } from '@dyingstar-admin/testing';
import { PlayersTable } from './PlayersTable';

describe('PlayersTable', () => {
  it('lists players with kind, reputation and playtime, and opens one', async () => {
    const onOpenPlayer = vi.fn();
    render(<PlayersTable players={createSocialDataset().players} onOpenPlayer={onOpenPlayer} />);
    const table = screen.getByRole('table', { name: 'Players' });

    const row = within(table).getByText('griefer42').closest('tr');
    expect(row).toHaveTextContent('Player');
    expect(row).toHaveTextContent('-27');
    expect(row).toHaveTextContent('1 h');
    await userEvent.click(within(table).getByText('griefer42'));
    expect(onOpenPlayer).toHaveBeenCalledWith(socialIds.griefer);
  });
});
