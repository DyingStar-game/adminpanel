import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BBCodeText } from './BBCodeText';

const labels = { code: 'Show the code', formatted: 'Show as in game' };

describe('BBCodeText', () => {
  it('shows the text as the game does, and the code typed on demand', async () => {
    const text = "[b]Salut[/b], c'est [color=#F8C3CD]Frank Leboeuf[/color]";
    render(<BBCodeText text={text} labels={labels} />);

    expect(screen.getByText('Salut').tagName).toBe('STRONG');
    expect(screen.getByText('Frank Leboeuf')).toHaveStyle({ color: '#F8C3CD' });
    expect(screen.queryByText(text)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Show the code' }));
    expect(screen.getByText(text)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show as in game' }));
    expect(screen.getByText('Salut').tagName).toBe('STRONG');
  });

  it('offers no switch for a plain text', () => {
    render(<BBCodeText text="Hauls ore." labels={labels} />);
    expect(screen.getByText('Hauls ore.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
