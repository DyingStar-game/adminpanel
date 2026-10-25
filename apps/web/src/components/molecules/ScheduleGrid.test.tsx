import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScheduleGrid } from './ScheduleGrid';

const props = {
  days: ['TTr..', 'a.TTt'],
  hours: 5,
  label: 'Week',
  dayLabel: (day: number) => `Day ${day + 1}`,
  letterLabel: (letter: string) =>
    ({ T: 'work', t: 'handoff', r: 'meal', a: 'chores' })[letter] ?? 'off',
  cellLabel: (day: number, hour: number, meaning: string) =>
    `Day ${day + 1}, ${hour} h: ${meaning}`,
};

describe('ScheduleGrid', () => {
  it('names every cell by its day, hour and meaning, and marks the current one', () => {
    render(<ScheduleGrid {...props} current={{ day: 1, hour: 2 }} />);

    const grid = screen.getByRole('grid', { name: 'Week' });
    expect(grid).toHaveAttribute('aria-readonly', 'true');
    expect(screen.getByRole('gridcell', { name: 'Day 1, 2 h: meal' })).toHaveTextContent('r');
    expect(screen.getByRole('gridcell', { name: 'Day 2, 2 h: work' })).toHaveAttribute(
      'aria-current',
      'time',
    );
    expect(screen.getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['Day 1', 'Day 2']);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('paints a clicked cell, and the cells swept with the button held', async () => {
    const onPaint = vi.fn();
    render(<ScheduleGrid {...props} onPaint={onPaint} />);

    await userEvent.click(screen.getByRole('gridcell', { name: 'Day 1, 3 h: off' }));
    expect(onPaint).toHaveBeenLastCalledWith(0, 3);

    fireEvent.pointerDown(screen.getByRole('gridcell', { name: 'Day 2, 0 h: chores' }));
    fireEvent.pointerEnter(screen.getByRole('gridcell', { name: 'Day 2, 1 h: off' }));
    fireEvent.pointerUp(screen.getByRole('grid'));
    fireEvent.pointerEnter(screen.getByRole('gridcell', { name: 'Day 2, 4 h: handoff' }));
    expect(onPaint.mock.calls.slice(1)).toEqual([
      [1, 0],
      [1, 1],
    ]);
  });

  it('paints from the keyboard', async () => {
    const onPaint = vi.fn();
    render(<ScheduleGrid {...props} onPaint={onPaint} />);

    screen.getByRole('gridcell', { name: 'Day 2, 4 h: handoff' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onPaint).toHaveBeenCalledWith(1, 4);
  });
});
