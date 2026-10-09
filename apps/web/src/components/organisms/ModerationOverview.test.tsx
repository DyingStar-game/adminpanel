import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { socialIds } from '@dyingstar-admin/testing';
import { useInProcessBff } from '@/test/bff';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { ModerationOverview } from './ModerationOverview';

describe('ModerationOverview', () => {
  it('shows the community figures, the most reported by name and the log', async () => {
    useInProcessBff();
    renderWithProviders(<ModerationOverview onOpenPlayer={vi.fn()} onOpenReport={vi.fn()} />);

    expect((await screen.findByText('Players')).nextSibling).toHaveTextContent('3');
    expect(screen.getByText('Active sanctions').nextSibling).toHaveTextContent('1');
    expect(await screen.findByRole('table', { name: 'Moderation log' })).toBeInTheDocument();
    expect(await screen.findByRole('table', { name: 'Most reported' })).toHaveTextContent(
      'griefer42',
    );
  });

  it('opens a player from the lowest reputation list', async () => {
    useInProcessBff();
    const onOpenPlayer = vi.fn();
    renderWithProviders(<ModerationOverview onOpenPlayer={onOpenPlayer} onOpenReport={vi.fn()} />);

    await userEvent.click(await screen.findByRole('cell', { name: 'griefer42' }));
    expect(onOpenPlayer).toHaveBeenCalledWith(socialIds.griefer);
  });

  it('says when social cannot be reached', async () => {
    useInProcessBff();
    server.use(http.get('*/api/social/stats', () => HttpResponse.json({}, { status: 502 })));
    renderWithProviders(<ModerationOverview onOpenPlayer={vi.fn()} onOpenReport={vi.fn()} />);

    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent(
      'unreachable',
    );
  });
});
