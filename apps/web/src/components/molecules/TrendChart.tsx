import { lineChartGeometry, type SeriesPoint } from '@/lib/simulation';
import { cn } from '@/lib/cn';

/** A horizontal reference: a stock's threshold or target. */
export interface TrendReference {
  value: number;
  label: string;
  /** Status tone of the line: `warning` (a threshold) or `good` (a target). */
  tone: 'warning' | 'good';
}

interface TrendChartProps {
  /** Accessible name of the chart (what it plots). */
  label: string;
  points: SeriesPoint[];
  references?: TrendReference[];
  formatValue: (value: number) => string;
  formatTime: (epochMs: number) => string;
  /** Shown instead of the chart when there is no point. */
  empty: string;
  /** `compact`: a sparkline without axes, for a table cell. */
  size?: 'default' | 'compact';
  /** The value axis starts at zero (stocks) or near the lowest value (prices). */
  fromZero?: boolean;
  className?: string;
}

const BOXES = {
  default: { width: 640, height: 220, padding: { left: 56, right: 72, top: 12, bottom: 24 } },
  compact: { width: 120, height: 32, padding: { left: 2, right: 6, top: 4, bottom: 4 } },
} as const;

const TONES = { warning: 'stroke-amber-500', good: 'stroke-success' } as const;

/**
 * One series over time as an inline SVG line chart (ADR 0025: no chart library): the line in the
 * accent colour, its last value marked, references as dashed status lines labelled at their
 * end, recessive value ticks and the first and last times. Every colour is a design token, so
 * the chart follows the theme. Hovering a point tells its time and value.
 */
export function TrendChart({
  label,
  points,
  references = [],
  formatValue,
  formatTime,
  empty,
  size = 'default',
  fromZero = true,
  className,
}: TrendChartProps) {
  if (points.length === 0) return <p className="text-sm text-fg-3">{empty}</p>;
  const box = BOXES[size];
  const g = lineChartGeometry(
    points,
    references.map((r) => r.value),
    box,
    { fromZero },
  );
  const compact = size === 'compact';
  const last = points.at(-1);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${box.width} ${box.height}`}
      className={cn(compact ? 'h-8 w-30' : 'h-auto w-full', className)}
    >
      <title>{label}</title>
      {!compact &&
        g.ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={g.inner.left}
              x2={g.inner.right}
              y1={g.y(tick)}
              y2={g.y(tick)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={g.inner.left - 6}
              y={g.y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-fg-3 text-3xs"
            >
              {formatValue(tick)}
            </text>
          </g>
        ))}
      {references.map((ref) => (
        <g key={ref.label}>
          <line
            x1={g.inner.left}
            x2={g.inner.right}
            y1={g.y(ref.value)}
            y2={g.y(ref.value)}
            className={TONES[ref.tone]}
            strokeWidth={compact ? 1 : 1.5}
            strokeDasharray="6 4"
          />
          {!compact && (
            <text
              x={g.inner.right + 6}
              y={g.y(ref.value)}
              dominantBaseline="middle"
              className="fill-fg-2 text-3xs"
            >
              {ref.label}
            </text>
          )}
        </g>
      ))}
      <path
        d={g.path}
        fill="none"
        className="stroke-link"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {last && (
        <circle
          cx={g.x(last.t)}
          cy={g.y(last.v)}
          r={compact ? 2.5 : 4}
          className="fill-link stroke-background"
          strokeWidth={2}
        />
      )}
      {!compact && (
        <>
          <text x={g.inner.left} y={box.height - 6} className="fill-fg-3 text-3xs">
            {formatTime(g.tMin)}
          </text>
          <text
            x={g.inner.right}
            y={box.height - 6}
            textAnchor="end"
            className="fill-fg-3 text-3xs"
          >
            {formatTime(g.tMax)}
          </text>
        </>
      )}
      {/* Hover targets larger than the marks: each point tells its time and value. */}
      {!compact &&
        points.map((p) => (
          <circle key={p.t} cx={g.x(p.t)} cy={g.y(p.v)} r={8} fill="transparent">
            <title>{`${formatTime(p.t)} · ${formatValue(p.v)}`}</title>
          </circle>
        ))}
    </svg>
  );
}
