import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PropertyInput } from './PropertyInput';

describe('PropertyInput', () => {
  it('fills x, y and z when a copied position is pasted in one axis', async () => {
    const onChange = vi.fn();
    render(<PropertyInput id="p" kind="vec3" label="position" value="0,0,0" onChange={onChange} />);

    await userEvent.click(screen.getByRole('textbox', { name: 'position y' }));
    await userEvent.paste('{"x":4449340.32,"y":2674885.87,"z":-3676467.6}');

    expect(onChange).toHaveBeenLastCalledWith('4449340.32,2674885.87,-3676467.6');
  });

  it('keeps a normal paste of a single number in its axis', async () => {
    const onChange = vi.fn();
    render(<PropertyInput id="p" kind="vec3" label="position" value="0,0,0" onChange={onChange} />);

    await userEvent.click(screen.getByRole('textbox', { name: 'position z' }));
    await userEvent.paste('5');

    expect(onChange).toHaveBeenLastCalledWith('0,0,05');
  });
});
