import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { IdLabel } from './IdLabel';

const ID = '3a55105e-0000-4000-8000-000000000001';

describe('IdLabel', () => {
  it('shows a short id, the whole one in its title, and copies the whole id', async () => {
    renderWithProviders(<IdLabel id={ID} />);

    expect(screen.getByText('3a55105e')).toHaveAttribute('title', ID);
    await userEvent.click(screen.getByRole('button', { name: 'Copy UUID' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(ID);
  });

  it('shows the whole id when asked', () => {
    renderWithProviders(<IdLabel id={ID} full copyLabel="Copy the mission id" />);
    expect(screen.getByText(ID)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy the mission id' })).toBeInTheDocument();
  });
});
