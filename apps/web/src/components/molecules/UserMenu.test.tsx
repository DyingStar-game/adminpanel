import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserMenu } from './UserMenu';

const labels = {
  account: 'Account',
  signedInAs: 'Signed in as',
  roles: 'Roles',
  noRoles: 'None',
  signOut: 'Sign out',
};

describe('UserMenu', () => {
  it('shows who is signed in, their roles, and signs out', async () => {
    const onSignOut = vi.fn();
    render(
      <UserMenu
        username="dev-editor"
        name="Dev Editor"
        roles={['player', 'persistence:write']}
        onSignOut={onSignOut}
        labels={labels}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Account' }));

    expect(screen.getByText('Dev Editor')).toBeInTheDocument();
    expect(screen.getByText('persistence:write')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalled();
  });
});
