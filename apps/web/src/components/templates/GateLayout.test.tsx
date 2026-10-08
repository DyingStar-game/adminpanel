import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GateLayout } from './GateLayout';

describe('GateLayout', () => {
  it('frames the card with the brand, its title and an aside', () => {
    render(
      <GateLayout title="Admin Panel" aside={<span>language</span>}>
        <p>Sign in</p>
      </GateLayout>,
    );

    expect(screen.getByRole('region', { name: 'Admin Panel' })).toHaveTextContent('DyingStar');
    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.getByText('language')).toBeInTheDocument();
  });
});
