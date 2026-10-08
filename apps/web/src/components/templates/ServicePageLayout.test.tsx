import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ServicePageLayout } from './ServicePageLayout';

describe('ServicePageLayout', () => {
  it('lays out the title, its meta and actions, then the content', () => {
    render(
      <ServicePageLayout
        title="Players"
        meta={<p>Search by name</p>}
        actions={<button type="button">Back</button>}
        leading={<span>avatar</span>}
      >
        <p>content</p>
      </ServicePageLayout>,
    );

    expect(screen.getByRole('heading', { name: 'Players' })).toBeInTheDocument();
    expect(screen.getByText('Search by name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByText('avatar')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});
