import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSocialDataset, organisationIds } from '@dyingstar-admin/testing';
import { renderWithProviders } from '@/test/render';
import { PoliticalEntitiesTable } from './PoliticalEntitiesTable';

const entities = createSocialDataset().politics.map((p) => ({ ...p, memberCount: 2 }));

describe('PoliticalEntitiesTable', () => {
  it('shows each entity with its level, and opens it', async () => {
    const onOpen = vi.fn();
    renderWithProviders(<PoliticalEntitiesTable entities={entities} onOpen={onOpen} />);
    const table = screen.getByRole('table', { name: 'Political entities' });

    expect(within(table).getByText('Country')).toBeInTheDocument();
    expect(within(table).getByText('Commune')).toBeInTheDocument();
    await userEvent.click(within(table).getByText('Port Gaea'));
    expect(onOpen).toHaveBeenCalledWith(organisationIds.commune);
  });
});
