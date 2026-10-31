import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMissionDataset, missionIds, organisationIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { MissionTerms } from './MissionTerms';

const { missions } = createMissionDataset();
const mission = (id: string) => {
  const found = missions.find((m) => m.id === id);
  if (!found) throw new Error(`fixture ${id}`);
  return found;
};

describe('MissionTerms', () => {
  it('says who issued it, who sees it, what it takes and its escrow', async () => {
    useInProcessBff();
    const onOpenCorporation = vi.fn();
    renderWithProviders(
      <MissionTerms
        detail={{ mission: mission(missionIds.transport), group: null, chain: [] }}
        onOpenMission={vi.fn()}
        onOpenCorporation={onOpenCorporation}
      />,
    );

    expect(screen.getByText("The issuer's corporation")).toBeInTheDocument();
    expect(screen.getByText('Minimum standing')).toBeInTheDocument();
    expect(screen.getByText('{"domain":"transport","min":20}')).toBeInTheDocument();
    expect(screen.getByText('Held')).toBeInTheDocument();
    expect(
      screen.getByText('On its own once every required objective is done'),
    ).toBeInTheDocument();
    // The issuer and the escrow's payer are the same corporation, named from `social`, each a
    // way to its page.
    const [issuer] = await screen.findAllByRole('button', { name: 'Deep Core Mining' });
    await userEvent.click(issuer as HTMLElement);
    expect(onOpenCorporation).toHaveBeenCalledWith(organisationIds.mining);
  });

  it('names a political issuer from the simulation, which `social` does not hold', async () => {
    useInProcessBff();
    renderWithProviders(
      <MissionTerms
        detail={{ mission: mission(missionIds.simulation), group: null, chain: [] }}
        onOpenMission={vi.fn()}
      />,
    );

    expect(await screen.findAllByText('ARES')).toHaveLength(2);
  });

  it("says a cancelled mission's escrow was refunded", () => {
    useInProcessBff();
    renderWithProviders(
      <MissionTerms
        detail={{ mission: mission(missionIds.cancelled), group: null, chain: [] }}
        onOpenMission={vi.fn()}
      />,
    );

    expect(screen.getByText('Refunded')).toBeInTheDocument();
    // Without a way to the player's sheet, their id.
    expect(
      screen.queryAllByRole('button').filter((b) => b.getAttribute('aria-label') !== 'Copy UUID'),
    ).toEqual([]);
  });

  it('says when a mission to finish first no longer exists', () => {
    useInProcessBff();
    renderWithProviders(
      <MissionTerms
        detail={{
          mission: mission(missionIds.delivery),
          group: null,
          chain: [{ id: missionIds.cancelled, title: '', status: 'unknown' }],
        }}
        onOpenMission={vi.fn()}
      />,
    );

    expect(screen.getByText('Mission removed')).toBeInTheDocument();
  });
});
