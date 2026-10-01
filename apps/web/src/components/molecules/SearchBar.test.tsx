import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
  it('submits the trimmed query on Enter and ignores blanks', async () => {
    const onSubmit = vi.fn();
    render(<SearchBar placeholder="Go to a UUID…" onSubmit={onSubmit} />);
    const input = screen.getByRole('textbox', { name: 'Go to a UUID…' });

    await userEvent.type(input, '   {Enter}');
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.type(input, ' 1b029618 {Enter}');
    expect(onSubmit).toHaveBeenCalledWith('1b029618');
  });
});
