import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createSocialDataset } from '@dyingstar-admin/testing';
import { SanctionBanner } from './SanctionBanner';

const [, mute] = createSocialDataset().sanctions;

describe('SanctionBanner', () => {
  it('shows each sanction in force with its end and reason', () => {
    if (!mute) throw new Error('fixture mute missing');
    render(<SanctionBanner sanctions={[mute, { ...mute, id: 9, type: 'ban', expiresAt: null }]} />);

    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent(/Mute until .* — Reputation below -25/);
    expect(banner).toHaveTextContent('Ban permanent — Reputation below -25');
  });

  it('shows nothing without a sanction in force', () => {
    render(<SanctionBanner sanctions={[]} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
