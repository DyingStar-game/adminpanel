import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { organisationIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { TaxSettings } from './TaxSettings';

describe('TaxSettings', () => {
  it("shows an entity's tax rates and minting policy", async () => {
    useInProcessBff();
    renderWithProviders(<TaxSettings entityId={organisationIds.commune} />);

    expect(await screen.findByText('5%')).toBeInTheDocument();
    expect(screen.getByText('2%')).toBeInTheDocument();
    expect(screen.getByText('Not allowed')).toBeInTheDocument();
  });
});
