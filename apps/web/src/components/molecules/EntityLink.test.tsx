import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { EntityLink } from './EntityLink';

const ID = '7c0a7e1e-0000-4000-8000-0000000000c1';

describe('EntityLink', () => {
  it('opens the entity by its name and copies its whole id without opening it', async () => {
    const onOpen = vi.fn();
    renderWithProviders(<EntityLink id={ID} label="ddurieux" onOpen={onOpen} />);

    await userEvent.click(screen.getByRole('button', { name: 'Copy UUID' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(ID);
    expect(onOpen).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /ddurieux/ }));
    expect(onOpen).toHaveBeenCalledWith(ID);
  });

  it('shows the short id as text without a page, still copyable', () => {
    renderWithProviders(<EntityLink id={ID} />);
    expect(screen.getByText('7c0a7e1e')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /7c0a7e1e/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy UUID' })).toBeInTheDocument();
  });
});
