import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContextMenu } from './ContextMenu';

const renderMenu = () => {
  const onClose = vi.fn();
  const add = vi.fn();
  const remove = vi.fn();
  render(
    <ContextMenu
      label="Actions here"
      x={10}
      y={20}
      onClose={onClose}
      items={[
        { key: 'add', icon: null, label: 'Add', onSelect: add },
        { key: 'delete', icon: null, label: 'Delete', onSelect: remove, destructive: true },
      ]}
    />,
  );
  return { onClose, add, remove };
};

describe('ContextMenu', () => {
  it('opens where asked, focused on its first item', () => {
    renderMenu();
    const menu = screen.getByRole('menu', { name: 'Actions here' });
    expect(menu).toHaveStyle({ left: '10px', top: '20px' });
    expect(screen.getByRole('menuitem', { name: 'Add' })).toHaveFocus();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveClass('text-destructive');
  });

  it('closes, then runs the chosen action', async () => {
    const { onClose, remove } = renderMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
  });

  it('closes on Escape', async () => {
    const { onClose, add } = renderMenu();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });
});
