import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { organisationIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { PoliticalEntityPicker } from './PoliticalEntityPicker';

describe('PoliticalEntityPicker', () => {
  it("searches social's political entities by name and picks one", async () => {
    useInProcessBff();
    const onChange = vi.fn();
    renderWithProviders(<PoliticalEntityPicker value={null} onChange={onChange} label="Search" />);

    await userEvent.type(screen.getByPlaceholderText('Search'), 'gaea');
    await userEvent.click(await screen.findByRole('option', { name: /Port Gaea/ }));
    expect(onChange).toHaveBeenCalledWith({ id: organisationIds.commune, name: 'Port Gaea' });
    expect(screen.queryByRole('option', { name: /Tarsis Union/ })).toBeNull();
  });
});
