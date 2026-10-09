import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OptionSelect } from './OptionSelect';

const options = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
];

describe('OptionSelect', () => {
  it('picks an option', async () => {
    const onChange = vi.fn();
    render(<OptionSelect label="Language" value="en" options={options} onChange={onChange} />);

    await userEvent.click(screen.getByRole('combobox', { name: 'Language' }));
    await userEvent.click(screen.getByRole('option', { name: 'Français' }));
    expect(onChange).toHaveBeenCalledWith('fr');
  });

  it('is compact by default, the size of an input in forms', () => {
    render(
      <>
        <OptionSelect label="Compact" value="en" options={options} onChange={vi.fn()} />
        <OptionSelect label="Form" value="en" options={options} onChange={vi.fn()} size="default" />
      </>,
    );

    expect(screen.getByRole('combobox', { name: 'Compact' })).toHaveClass('h-7', 'text-xs');
    const form = screen.getByRole('combobox', { name: 'Form' });
    expect(form).toHaveClass('h-8', 'text-sm');
    expect(form).not.toHaveClass('h-7');
  });
});
