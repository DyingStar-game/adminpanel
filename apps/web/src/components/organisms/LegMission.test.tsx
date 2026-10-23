import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { missionIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { LegMission } from './LegMission';

describe('LegMission (ADR 0028)', () => {
  it("shows a leg's mission by its title and status, and opens it", async () => {
    useInProcessBff();
    const onOpenMission = vi.fn();
    renderWithProviders(
      <LegMission missionId={missionIds.simulation} onOpenMission={onOpenMission} />,
    );

    const link = await screen.findByText('Transport 600 l Water → M0002');
    expect(screen.getByText('Available')).toBeInTheDocument();
    await userEvent.click(link);
    expect(onOpenMission).toHaveBeenCalledWith(missionIds.simulation);
  });

  it('keeps its id when mission does not know it', async () => {
    useInProcessBff();
    const unknown = '3a55105e-0000-4000-8000-0000000000ff';
    renderWithProviders(<LegMission missionId={unknown} />);

    expect(await screen.findByTitle(unknown)).toHaveTextContent(unknown.slice(0, 8));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText('Available')).not.toBeInTheDocument();
  });
});
