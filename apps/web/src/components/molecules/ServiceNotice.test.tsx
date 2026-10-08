import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ServiceNotice } from './ServiceNotice';

describe('ServiceNotice', () => {
  it('says why the view is empty, as an alert', () => {
    render(<ServiceNotice message="Social is unreachable." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Social is unreachable.');
  });
});
