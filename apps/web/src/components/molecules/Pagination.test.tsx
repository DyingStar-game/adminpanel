import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('shows the range and moves between pages', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageSize={50} total={262} onPageChange={onPageChange} />);

    expect(screen.getByText('1–50 of 262')).toBeInTheDocument();
    expect(screen.getByText('page 1 / 6')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('handles the last page and empty lists', () => {
    const { rerender } = render(
      <Pagination page={6} pageSize={50} total={262} onPageChange={vi.fn()} />,
    );
    expect(screen.getByText('251–262 of 262')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();

    rerender(<Pagination page={1} pageSize={50} total={0} onPageChange={vi.fn()} />);
    expect(screen.getByText('No item')).toBeInTheDocument();
  });
});
