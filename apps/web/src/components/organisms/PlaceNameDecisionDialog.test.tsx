import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { DiscoveryRowSchema, type DiscoveryRow } from '@dyingstar-admin/schemas';
import { createDataset, createDiscoveries, ids, poiIds, socialIds } from '@dyingstar-admin/testing';
import type { PlaceNameDecision } from '@/lib/discoveries';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { PlaceNameDecisionDialog } from './PlaceNameDecisionDialog';

const discoveryRow = (uuid: string): DiscoveryRow => {
  const item = createDiscoveries().find((i) => i.object_uuid === uuid);
  if (!item) throw new Error('fixture missing');
  return DiscoveryRowSchema.parse({ uuid, object_data: item.object_data });
};

const useBffWithDiscoveries = () => useInProcessBff([...createDataset(), ...createDiscoveries()]);

const renderDialog = (decision: PlaceNameDecision, uuid: string = ids.discoveryEcho) => {
  const onClose = vi.fn();
  renderWithProviders(
    <PlaceNameDecisionDialog
      discovery={discoveryRow(uuid)}
      decision={decision}
      onClose={onClose}
    />,
  );
  return { onClose, dialog: screen.getByRole('dialog') };
};

describe('PlaceNameDecisionDialog (ADR 0032)', () => {
  it('approves a corrected name after a summary, and says the discoverer was told', async () => {
    const bff = useBffWithDiscoveries();
    const success = vi.spyOn(toast, 'success');
    const { onClose, dialog } = renderDialog('approve');

    const field = within(dialog).getByLabelText('Approved name');
    expect(field).toHaveValue("L'Antre des Échos");
    await userEvent.clear(field);
    await userEvent.type(field, '  Antre   des Échos ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Publish “Antre des Échos” (Cave) and tell griefer42?',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.persistence.items.get(ids.discoveryEcho)?.object_data).toMatchObject({
      status: 'approved',
      approved_name: 'Antre des Échos',
    });
    expect(bff.inventory.pois.find((p) => p.id === poiIds.caveEcho)?.name).toBe('Antre des Échos');
    expect(success).toHaveBeenCalledWith('“Antre des Échos” approved', {
      description: 'griefer42 was told in game.',
    });
    success.mockRestore();
  });

  it("says what is wrong with a name breaking the game's rule", async () => {
    useBffWithDiscoveries();
    const { dialog } = renderDialog('approve');

    const field = within(dialog).getByLabelText('Approved name');
    await userEvent.clear(field);
    await userEvent.type(field, 'Cave #1');

    expect(
      await within(dialog).findByText('Letters, digits, spaces, apostrophes and hyphens only.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('refuses with a required reason, the offline discoverer finding it in their history', async () => {
    const bff = useBffWithDiscoveries();
    const success = vi.spyOn(toast, 'success');
    const { onClose, dialog } = renderDialog('refuse', ids.discoveryFang);

    expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('Reason'), 'Already the name of a moon.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Refuse “Fang Hollow” and tell ddurieux: “Already the name of a moon.”?',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.persistence.items.get(ids.discoveryFang)?.object_data).toMatchObject({
      status: 'refused',
      refusal_reason: 'Already the name of a moon.',
    });
    expect(bff.social.writes.map((w) => w.call)).toEqual([
      `POST /internal/players/${socialIds.reporter}/notifications`,
      `POST /internal/players/${socialIds.reporter}/activity`,
    ]);
    expect(success).toHaveBeenCalledWith('“Fang Hollow” refused', {
      description: 'ddurieux is offline: they will find it in their history.',
    });
    success.mockRestore();
  });

  it('closes on a discovery changed meanwhile, the list being read again', async () => {
    const bff = useBffWithDiscoveries();
    const error = vi.spyOn(toast, 'error');
    const stored = bff.persistence.items.get(ids.discoveryEcho);
    if (stored) stored.object_data.proposed_name = 'Something else';
    const { onClose, dialog } = renderDialog('approve');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(error).toHaveBeenCalledWith('This discovery changed meanwhile: the list is read again.');
    expect(bff.persistence.items.get(ids.discoveryEcho)?.object_data.status).toBe('pending');
    error.mockRestore();
  });
});
