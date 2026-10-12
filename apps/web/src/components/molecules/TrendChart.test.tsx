import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrendChart } from './TrendChart';

const points = [
  { t: Date.UTC(2026, 9, 11, 10), v: 400 },
  { t: Date.UTC(2026, 9, 11, 11), v: 250 },
  { t: Date.UTC(2026, 9, 11, 12), v: 120 },
];
const format = {
  formatValue: (v: number) => `${v} l`,
  formatTime: (t: number) => new Date(t).toISOString().slice(11, 16),
};

describe('TrendChart', () => {
  it('draws the series with its references and tells each point on hover', () => {
    render(
      <TrendChart
        label="Water at Mine Haute"
        points={points}
        references={[
          { value: 300, label: 'Threshold', tone: 'warning' },
          { value: 1_000, label: 'Target', tone: 'good' },
        ]}
        empty="No history"
        {...format}
      />,
    );

    const chart = screen.getByRole('img', { name: 'Water at Mine Haute' });
    expect(chart).toHaveTextContent('Threshold');
    expect(chart).toHaveTextContent('Target');
    expect(chart).toHaveTextContent('10:00');
    expect(chart).toHaveTextContent('12:00');
    expect(chart.querySelectorAll('title')).toHaveLength(4);
    expect(screen.getByText('12:00 · 120 l')).toBeInTheDocument();
  });

  it('says so when there is no point, and drops the axes when compact', () => {
    const { rerender } = render(
      <TrendChart label="Price" points={[]} empty="No history" {...format} />,
    );
    expect(screen.getByText('No history')).toBeInTheDocument();

    rerender(<TrendChart label="Price" points={points} size="compact" empty="-" {...format} />);
    expect(screen.getByRole('img', { name: 'Price' })).not.toHaveTextContent('10:00');
  });
});
