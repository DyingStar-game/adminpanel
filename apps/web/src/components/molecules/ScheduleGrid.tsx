import { useState } from 'react';
import { cn } from '@/lib/cn';
import { letterClass } from '@/lib/npcs';

interface ScheduleGridProps {
  /** One string per rota-day, one letter per planetary hour. */
  days: readonly string[];
  /** Hours of a planetary day: the columns. */
  hours: number;
  /** Accessible name of the grid. */
  label: string;
  /** Row heading of a day (0-based). */
  dayLabel: (day: number) => string;
  /** What a letter means, for each cell's name. */
  letterLabel: (letter: string) => string;
  /** Name of a cell: its day, its hour and its meaning. */
  cellLabel: (day: number, hour: number, meaning: string) => string;
  /** The cell of now, outlined. */
  current?: { day: number; hour: number } | null | undefined;
  /** Editable: a cell clicked (or swept while the button is held) is painted. */
  onPaint?: ((day: number, hour: number) => void) | undefined;
}

/**
 * A shift pattern as a grid (ADR 0026): rota-days in rows, planetary hours in columns, each cell
 * coloured by its letter and named for screen readers. Read only, or painted with the pointer
 * (click, or sweep with the button held). Pure: the caller holds the grid.
 */
export function ScheduleGrid({
  days,
  hours,
  label,
  dayLabel,
  letterLabel,
  cellLabel,
  current,
  onPaint,
}: ScheduleGridProps) {
  const [painting, setPainting] = useState(false);
  const columns = { gridTemplateColumns: `4.5rem repeat(${hours}, minmax(0, 1fr))` };

  return (
    <div
      role="grid"
      aria-label={label}
      aria-readonly={!onPaint}
      className="flex min-w-[40rem] flex-col gap-px select-none"
      onPointerUp={() => setPainting(false)}
      onPointerLeave={() => setPainting(false)}
    >
      <div role="row" className="grid gap-px" style={columns}>
        <span role="columnheader" />
        {Array.from({ length: hours }, (_, hour) => (
          <span
            key={hour}
            role="columnheader"
            className="text-center font-mono text-3xs text-fg-3 tabular-nums"
          >
            {hour}
          </span>
        ))}
      </div>
      {days.map((row, day) => (
        <div key={day} role="row" className="grid gap-px" style={columns}>
          <span role="rowheader" className="truncate pr-2 text-xs text-fg-3">
            {dayLabel(day)}
          </span>
          {Array.from({ length: hours }, (_, hour) => {
            const letter = row[hour] ?? '.';
            const name = cellLabel(day, hour, letterLabel(letter));
            const now = current?.day === day && current.hour === hour;
            const cell = cn(
              'flex h-6 items-center justify-center rounded-xs font-mono text-3xs text-foreground/80',
              letterClass(letter),
              now && 'ring-2 ring-link ring-offset-1 ring-offset-background',
            );
            return onPaint ? (
              <button
                key={hour}
                type="button"
                role="gridcell"
                aria-label={name}
                title={name}
                className={cn(cell, 'cursor-crosshair hover:brightness-125')}
                onPointerDown={(event) => {
                  event.preventDefault();
                  setPainting(true);
                  onPaint(day, hour);
                }}
                onPointerEnter={() => painting && onPaint(day, hour)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onPaint(day, hour);
                  }
                }}
              >
                {letter}
              </button>
            ) : (
              <span
                key={hour}
                role="gridcell"
                aria-label={name}
                aria-current={now ? 'time' : undefined}
                title={name}
                className={cell}
              >
                {letter}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
