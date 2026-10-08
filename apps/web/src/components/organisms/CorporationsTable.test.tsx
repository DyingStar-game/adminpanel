import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSocialDataset, organisationIds } from '@dyingstar-admin/testing';
import { renderWithProviders } from '@/test/render';
import { CorporationsTable } from './CorporationsTable';

const corporations = createSocialDataset().corporations.map((c) => ({ ...c, memberCount: 1 }));

describe('CorporationsTable', () => {
  it('shows each corporation with its ticker and recruitment, and opens it', async () => {
    const onOpen = vi.fn();
    renderWithProviders(<CorporationsTable corporations={corporations} onOpen={onOpen} />);
    const table = screen.getByRole('table', { name: 'Corporations' });

    expect(within(table).getByText('DCM')).toBeInTheDocument();
    expect(within(table).getAllByText('On application')).toHaveLength(2);
    await userEvent.click(within(table).getByText('Deep Core Mining'));
    expect(onOpen).toHaveBeenCalledWith(organisationIds.mining);
  });

  it('takes its own name as a list of subsidiaries', () => {
    renderWithProviders(
      <CorporationsTable corporations={[]} label="Subsidiaries" onOpen={vi.fn()} />,
    );
    expect(screen.getByRole('table', { name: 'Subsidiaries' })).toHaveTextContent('Nothing yet.');
  });
});
