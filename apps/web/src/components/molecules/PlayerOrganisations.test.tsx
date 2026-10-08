import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createSocialDataset, socialIds } from '@dyingstar-admin/testing';
import { PlayerOrganisations } from './PlayerOrganisations';

describe('PlayerOrganisations', () => {
  it('lists corporations with their ticker and political entities with their type', () => {
    const memberships = createSocialDataset().memberships[socialIds.griefer] ?? null;
    render(<PlayerOrganisations memberships={memberships} />);

    expect(screen.getByText('Deep Core Mining')).toBeInTheDocument();
    expect(screen.getByText('[DCM]')).toBeInTheDocument();
    expect(screen.getByText('Commune')).toBeInTheDocument();
    expect(screen.getByText('Port Gaea')).toBeInTheDocument();
  });

  it('says when there is none, and waits while loading', () => {
    const { rerender } = render(<PlayerOrganisations memberships={null} />);
    expect(screen.getByText('…')).toBeInTheDocument();
    rerender(<PlayerOrganisations memberships={{ corporations: [], politics: [] }} />);
    expect(screen.getByText('Nothing yet.')).toBeInTheDocument();
  });
});
