import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { socialIds } from '@dyingstar-admin/testing';
import { PermissionsContext } from '@/hooks/useCan';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { SanctionDialog } from './SanctionDialog';

const renderDialog = (permissions: string[]) => {
  const onClose = vi.fn();
  renderWithProviders(
    <PermissionsContext.Provider value={permissions}>
      <SanctionDialog playerId={socialIds.reporter} playerName="ddurieux" onClose={onClose} />
    </PermissionsContext.Provider>,
  );
  return { onClose, dialog: screen.getByRole('dialog') };
};

describe('SanctionDialog', () => {
  it('needs a reason, shows a summary, then sanctions and closes', async () => {
    const bff = useInProcessBff();
    const { onClose, dialog } = renderDialog(['social.moderate']);

    expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('Reason'), '  Spam  ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Warning for ddurieux, One-off: “Spam”',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bff.social.writes[0]?.body).toEqual({
      type: 'warning',
      reason: 'Spam',
      durationHours: null,
    });
  });

  it('offers suspension and ban to admins', async () => {
    useInProcessBff();
    const { dialog } = renderDialog(['social.moderate', 'social.sanctionSevere']);

    const [typeSelect] = within(dialog).getAllByRole('combobox');
    if (!typeSelect) throw new Error('no type select');
    await userEvent.click(typeSelect);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Warning',
      'Mute',
      'Suspension',
      'Ban',
    ]);
  });
});
