import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createSocialDataset,
  membershipsOf,
  organisationIds,
  socialIds,
} from '@dyingstar-admin/testing';
import { PlayerOrganisations } from './PlayerOrganisations';

describe('PlayerOrganisations', () => {
  const links = { onOpenCorporation: vi.fn(), onOpenPoliticalEntity: vi.fn() };

  it('lists corporations with their ticker and political entities with their type', () => {
    const memberships = membershipsOf(createSocialDataset(), socialIds.griefer);
    render(<PlayerOrganisations memberships={memberships} {...links} />);

    expect(screen.getByText('Deep Core Mining')).toBeInTheDocument();
    expect(screen.getByText('[DCM]')).toBeInTheDocument();
    expect(screen.getByText('Commune')).toBeInTheDocument();
    expect(screen.getByText('Port Gaea')).toBeInTheDocument();
  });

  it('opens each organisation', async () => {
    const memberships = membershipsOf(createSocialDataset(), socialIds.griefer);
    render(<PlayerOrganisations memberships={memberships} {...links} />);

    await userEvent.click(screen.getByRole('button', { name: 'Deep Core Mining' }));
    expect(links.onOpenCorporation).toHaveBeenCalledWith(organisationIds.mining);
    await userEvent.click(screen.getByRole('button', { name: 'Port Gaea' }));
    expect(links.onOpenPoliticalEntity).toHaveBeenCalledWith(organisationIds.commune);
  });

  it('says when there is none, and waits while loading', () => {
    const { rerender } = render(<PlayerOrganisations memberships={null} {...links} />);
    expect(screen.getByText('…')).toBeInTheDocument();
    rerender(<PlayerOrganisations memberships={{ corporations: [], politics: [] }} {...links} />);
    expect(screen.getByText('Nothing yet.')).toBeInTheDocument();
  });
});
