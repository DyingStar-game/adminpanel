import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/render';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('shows the BFF version when the healthcheck answers', async () => {
    server.use(http.get('*/health', () => HttpResponse.json({ status: 'ok', version: '9.9.9' })));

    renderWithProviders(<HomePage />);

    expect(await screen.findByText(/9\.9\.9/)).toBeInTheDocument();
  });

  it('reports the BFF as unreachable on error', async () => {
    server.use(http.get('*/health', () => HttpResponse.json({}, { status: 500 })));

    renderWithProviders(<HomePage />);

    expect(await screen.findByText(/unreachable/)).toBeInTheDocument();
  });

  it('switches the UI to French', async () => {
    server.use(http.get('*/health', () => HttpResponse.json({ status: 'ok', version: '1.0.0' })));
    renderWithProviders(<HomePage />);

    await userEvent.selectOptions(screen.getByRole('combobox'), 'fr');

    expect(await screen.findByText('Socle prêt')).toBeInTheDocument();
  });
});
