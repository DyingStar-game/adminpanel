import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { OrganisationRolesTable } from './OrganisationRolesTable';

const roles = [
  { id: 1, name: 'CEO', priority: 100, permissions: [], head: true, isDefault: false },
  {
    id: 2,
    name: 'Director',
    priority: 50,
    permissions: ['invite', 'recruit'],
    head: false,
    isDefault: false,
  },
  { id: 3, name: 'Member', priority: 0, permissions: [], head: false, isDefault: true },
];

describe('OrganisationRolesTable', () => {
  it('shows each rank with its priority and permissions, the head holding them all', () => {
    renderWithProviders(<OrganisationRolesTable roles={roles} label="Ranks" />);
    const rows = within(screen.getByRole('table', { name: 'Ranks' })).getAllByRole('row');

    expect(rows[1]).toHaveTextContent('CEOLeader100Every permission');
    expect(rows[2]).toHaveTextContent('Director50inviterecruit');
    expect(rows[3]).toHaveTextContent('MemberNew members0—');
  });
});
