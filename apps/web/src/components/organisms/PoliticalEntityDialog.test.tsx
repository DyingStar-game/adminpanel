import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { socialIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { PoliticalEntityDialog } from './PoliticalEntityDialog';

describe('PoliticalEntityDialog', () => {
  it('creates a political entity of a level with the head picked', async () => {
    const bff = useInProcessBff();
    const onCreated = vi.fn();
    renderWithProviders(<PoliticalEntityDialog onClose={vi.fn()} onCreated={onCreated} />);
    const dialog = screen.getByRole('dialog', { name: 'Create a political entity' });

    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Level' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Country' }));
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Free Colonies');
    await userEvent.type(within(dialog).getByPlaceholderText(/Search a player/), 'grief');
    await userEvent.click(await screen.findByRole('option', { name: /griefer42/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Free Colonies, Country.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(bff.social.writes[0]).toMatchObject({
      call: 'POST /internal/politics',
      body: { type: 'country', name: 'Free Colonies', headId: socialIds.griefer },
    });
  });
});
