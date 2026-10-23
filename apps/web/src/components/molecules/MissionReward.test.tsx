import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { MissionReward } from './MissionReward';

const rewards = [
  { type: 'credits' as const, currency: 'credits', amount: 4_000 },
  { type: 'item' as const, itemId: 'drill_bit', quantity: 2 },
];

describe('MissionReward', () => {
  it('lists the credits and each item', () => {
    renderWithProviders(<MissionReward rewards={rewards} />);
    expect(screen.getByText('4,000 credits')).toBeInTheDocument();
    expect(screen.getByText('drill_bit')).toBeInTheDocument();
    expect(screen.getByText('2 ×')).toBeInTheDocument();
  });

  it('shows the standing granted in a domain, counted in a table', () => {
    const standing = [
      ...rewards,
      { type: 'standing' as const, domain: 'transport' as const, amount: 5 },
    ];
    renderWithProviders(<MissionReward rewards={standing} />);
    expect(screen.getByText('+5 standing in Transport')).toBeInTheDocument();
    const { container } = renderWithProviders(<MissionReward rewards={standing} compact />);
    expect(container).toHaveTextContent('4,000 credits + 1 item + 1 standing');
  });

  it('counts the items in a table, and shows a dash when nothing is paid', () => {
    const { container } = renderWithProviders(<MissionReward rewards={rewards} compact />);
    expect(container).toHaveTextContent('4,000 credits + 1 item');
    renderWithProviders(<MissionReward rewards={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
