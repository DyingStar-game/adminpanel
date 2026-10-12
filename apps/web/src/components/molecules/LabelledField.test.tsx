import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LabelledField } from './LabelledField';

describe('LabelledField', () => {
  it('labels its control and shows the hint, or the error instead', () => {
    const { rerender } = render(
      <LabelledField id="cap" label="Capacity" hint="Leave empty for none.">
        <input id="cap" aria-describedby="cap-message" />
      </LabelledField>,
    );
    expect(screen.getByLabelText('Capacity')).toHaveAccessibleDescription('Leave empty for none.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    rerender(
      <LabelledField id="cap" label="Capacity" hint="Leave empty for none." error="Too small.">
        <input id="cap" aria-describedby="cap-message" />
      </LabelledField>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Too small.');
    expect(screen.queryByText('Leave empty for none.')).not.toBeInTheDocument();
  });
});
