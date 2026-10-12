import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricMap } from './MetricMap';

describe('MetricMap', () => {
  it('draws the metric grid with its caption, and the layers given', () => {
    render(
      <div style={{ width: 800, height: 600 }}>
        <MetricMap gridCaption={(step, major) => `Cells ${step}, lines ${major}`}>
          <p>layer</p>
        </MetricMap>
      </div>,
    );

    expect(screen.getByText(/^Cells .+, lines .+$/)).toBeInTheDocument();
    expect(screen.getByText('layer')).toBeInTheDocument();
  });
});
