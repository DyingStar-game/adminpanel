import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { socialIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { ProfilePicker } from './ProfilePicker';

describe('ProfilePicker', () => {
  it("searches social's profiles by name and picks one", async () => {
    useInProcessBff();
    const onChange = vi.fn();
    renderWithProviders(<ProfilePicker value={null} onChange={onChange} label="Search" />);

    await userEvent.type(screen.getByPlaceholderText('Search'), 'grief');
    await userEvent.click(await screen.findByRole('option', { name: /griefer42/ }));
    expect(onChange).toHaveBeenCalledWith(socialIds.griefer);
    expect(screen.queryByRole('option', { name: /ddurieux/ })).toBeNull();
  });
});
