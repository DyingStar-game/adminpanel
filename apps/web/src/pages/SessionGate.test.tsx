import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/render';
import { SessionGate } from './SessionGate';

const me = (body: Record<string, unknown>, status = 200) =>
  server.use(http.get('*/api/me', () => HttpResponse.json(body, { status })));

const renderGate = () =>
  renderWithProviders(
    <SessionGate>
      <p>The app</p>
    </SessionGate>,
  );

describe('SessionGate', () => {
  it('shows the sign-in page while signed out, back to the page on screen', async () => {
    window.history.replaceState(null, '', '/explorer?type=vehicle');
    me({ error: 'UNAUTHENTICATED', message: 'Sign in first' }, 401);
    renderGate();

    const signIn = await screen.findByRole('link', { name: 'Sign in' });

    expect(signIn).toHaveAttribute(
      'href',
      `/auth/login?returnTo=${encodeURIComponent('/explorer?type=vehicle')}`,
    );
    expect(screen.queryByText('The app')).not.toBeInTheDocument();
  });

  it('explains a failed sign-in', async () => {
    window.history.replaceState(null, '', '/?signin=failed');
    me({ error: 'UNAUTHENTICATED', message: 'Sign in first' }, 401);
    renderGate();

    expect(await screen.findByRole('alert')).toHaveTextContent('Sign-in failed');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/auth/login?returnTo=%2F',
    );
  });

  it('refuses a signed-in player without a role opening the panel', async () => {
    me({
      user: { id: 'u', username: 'devplayer', name: null },
      roles: ['player'],
      permissions: [],
      access: false,
    });
    let loggedOut = false;
    server.use(
      http.post('*/auth/logout', () => {
        loggedOut = true;
        return HttpResponse.json({ redirect: '/' });
      }),
    );
    renderGate();

    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
    expect(screen.getByText(/signed in as devplayer/)).toBeInTheDocument();
    expect(screen.queryByText('The app')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(loggedOut).toBe(true);
  });

  it('opens the app with a role', async () => {
    me({
      user: { id: 'u', username: 'dev-editor', name: 'Dev Editor' },
      roles: ['persistence:write'],
      permissions: ['persistence.read', 'persistence.write'],
      access: true,
    });
    renderGate();

    expect(await screen.findByText('The app')).toBeInTheDocument();
  });

  it('offers to try again when the BFF does not answer', async () => {
    me({ error: 'INTERNAL_ERROR', message: 'down' }, 500);
    renderGate();

    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent(
      'unreachable',
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
