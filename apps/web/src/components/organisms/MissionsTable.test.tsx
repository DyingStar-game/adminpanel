import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMissionDataset, missionIds } from '@dyingstar-admin/testing';
import { renderWithProviders } from '@/test/render';
import { MissionsTable } from './MissionsTable';

const { missions } = createMissionDataset();

describe('MissionsTable', () => {
  it('shows each mission with its category, origin, issuer, status and reward', () => {
    renderWithProviders(<MissionsTable missions={missions} onOpen={vi.fn()} />);
    const table = screen.getByRole('table', { name: 'Missions' });

    const row = within(table).getByText('Escort the drill parts').closest('tr') as HTMLElement;
    expect(row).toHaveTextContent('Transport');
    expect(row).toHaveTextContent("Player's");
    expect(row).toHaveTextContent('Corporation');
    expect(row).toHaveTextContent('Available');
    expect(row).toHaveTextContent('4,000 credits + 1 item');
    // A mission shared with a group says so.
    expect(
      within(
        within(table).getByText('Clear the relay station').closest('tr') as HTMLElement,
      ).getByText('Group'),
    ).toBeInTheDocument();
  });

  it('names the simulation as the issuer of its missions (ADR 0028)', () => {
    renderWithProviders(<MissionsTable missions={missions} onOpen={vi.fn()} />);
    const table = screen.getByRole('table', { name: 'Missions' });

    const row = within(table).getByText('Transport 600 l Water → M0002').closest('tr');
    expect(row).toHaveTextContent('Simulation');
    expect(row).not.toHaveTextContent('Political entity');
  });

  it('shows a category mission no longer offers as stored, and opens a mission', async () => {
    const onOpen = vi.fn();
    renderWithProviders(<MissionsTable missions={missions} onOpen={onOpen} />);
    const table = screen.getByRole('table', { name: 'Missions' });

    const row = within(table).getByText('Buy my spare battery').closest('tr') as HTMLElement;
    expect(row).toHaveTextContent('Trading');
    await userEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith(missionIds.cancelled);
  });

  it('says when there is none', () => {
    renderWithProviders(<MissionsTable missions={[]} onOpen={vi.fn()} />);
    expect(screen.getByRole('table', { name: 'Missions' })).toHaveTextContent('Nothing yet.');
  });
});
