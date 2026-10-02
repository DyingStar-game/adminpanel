import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ObjectData } from '@dyingstar-admin/schemas';
import { MonoText } from '@/components/atoms/MonoText';
import type { RefTarget } from '@/components/molecules/UuidLink';
import { cn } from '@/lib/cn';
import { typeColor } from '@/lib/objectTypes';
import { sceneModel, valueAt, type Schematic } from '@/lib/schematics';

interface SchematicCardProps {
  schematic: Schematic;
  data: ObjectData;
  resolveRef: (uuid: string) => RefTarget;
  onNavigate: (uuid: string) => void;
}

/** Pixels per grid unit of a schematic. */
const U = 22;
const number = (value: unknown) => (typeof value === 'number' ? value : null);
const reference = (value: unknown) => (typeof value === 'string' && value !== '' ? value : null);

/** Generic renderer of a declarative scene schematic (ADR 0016), bound to live data. */
export function SchematicCard({ schematic, data, resolveRef, onNavigate }: SchematicCardProps) {
  const { t, i18n } = useTranslation();
  const label = (key: string) =>
    t(`schematic.labels.${key}` as 'schematic.labels.cab', { defaultValue: key });
  const format = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });
  const [width, height] = schematic.size;

  return (
    <div className="flex flex-col gap-3">
      <Readouts schematic={schematic} data={data} label={label} format={format} />
      <svg
        role="img"
        aria-label={label(schematic.title)}
        viewBox={`${-U} ${-U / 2} ${(width + 2) * U} ${(height + 1) * U}`}
        className="mx-auto max-h-[440px] w-full max-w-[320px] font-mono"
      >
        {schematic.shapes.map((shape) => {
          const value = shape.value ? number(valueAt(data, shape.value.path)) : null;
          return (
            <g key={shape.label}>
              <rect
                x={shape.at[0] * U}
                y={shape.at[1] * U}
                width={shape.size[0] * U}
                height={shape.size[1] * U}
                rx={shape.kind === 'body' ? 14 : 6}
                fill={shape.kind === 'body' ? 'var(--ds-bg)' : 'var(--ds-bg-2)'}
                stroke="var(--ds-line-2)"
                strokeWidth={1.5}
                strokeDasharray={shape.kind === 'cargo' ? '6 4' : undefined}
              />
              <text
                x={(shape.at[0] + shape.size[0] / 2) * U}
                // The body's label sits at the top, leaving room for its seats.
                y={
                  shape.kind === 'body'
                    ? shape.at[1] * U + 16
                    : (shape.at[1] + shape.size[1] / 2) * U
                }
                textAnchor="middle"
                fontSize={11}
                fill="var(--ds-fg-3)"
              >
                {label(shape.label)}
              </text>
              {shape.value && (
                <text
                  x={(shape.at[0] + shape.size[0] / 2) * U}
                  y={(shape.at[1] + shape.size[1] / 2) * U + 18}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={600}
                  fill="var(--ds-fg)"
                >
                  {value === null ? '—' : `${format.format(value)} ${shape.value.unit ?? ''}`}
                </text>
              )}
            </g>
          );
        })}

        {schematic.doors.map((door) => {
          const open = valueAt(data, door.path);
          return (
            <rect
              key={door.path}
              x={door.at[0] * U - 3}
              y={(door.at[1] - 1) * U}
              width={6}
              height={2 * U}
              rx={3}
              fill={
                open === true ? 'var(--ds-ok)' : open === false ? 'var(--ds-fg-3)' : 'transparent'
              }
              stroke="var(--ds-fg-3)"
              strokeDasharray={typeof open === 'boolean' ? undefined : '3 3'}
            >
              <title>
                {label(door.label)} ·{' '}
                {open === true
                  ? t('schematic.open')
                  : open === false
                    ? t('schematic.closed')
                    : t('schematic.unknown')}
              </title>
            </rect>
          );
        })}

        {schematic.seats.map((seat) => {
          const uuid = reference(valueAt(data, seat.path));
          const target = uuid ? resolveRef(uuid) : null;
          const name =
            target?.status === 'found'
              ? target.label
              : uuid
                ? uuid.slice(0, 8)
                : t('schematic.empty');
          return (
            <Slot
              key={seat.path}
              uuid={uuid}
              onNavigate={onNavigate}
              title={`${label(seat.label)} · ${name}`}
            >
              <circle
                cx={seat.at[0] * U}
                cy={seat.at[1] * U}
                r={U * 0.75}
                fill={uuid ? typeColor('player') : 'var(--ds-bg)'}
                stroke={
                  target?.status === 'missing'
                    ? 'var(--ds-danger)'
                    : uuid
                      ? typeColor('player')
                      : 'var(--ds-line-2)'
                }
                strokeWidth={1.5}
                strokeDasharray={uuid ? undefined : '3 3'}
              />
              <text
                x={seat.at[0] * U}
                y={seat.at[1] * U + U * 1.45}
                textAnchor="middle"
                fontSize={10}
                fill="var(--ds-fg-2)"
              >
                {label(seat.label)}
              </text>
              <text
                x={seat.at[0] * U}
                y={seat.at[1] * U + U * 2.05}
                textAnchor="middle"
                fontSize={10}
                fill={uuid ? 'var(--ds-acc)' : 'var(--ds-fg-3)'}
              >
                {name}
              </text>
            </Slot>
          );
        })}

        {schematic.bays.map((bay) => {
          const uuid = reference(valueAt(data, bay.path));
          const target = uuid ? resolveRef(uuid) : null;
          const missing = target?.status === 'missing';
          const model =
            target?.status === 'found'
              ? (sceneModel(target.scenename) ?? target.label)
              : missing
                ? t('value.brokenLink')
                : uuid
                  ? '…'
                  : t('schematic.empty');
          const color = typeColor('vehicle_component');
          return (
            <Slot
              key={bay.path}
              uuid={missing ? null : uuid}
              onNavigate={onNavigate}
              title={`${bay.label} · ${model}`}
            >
              <rect
                x={(bay.at[0] - 0.9) * U}
                y={(bay.at[1] - 0.9) * U}
                width={1.8 * U}
                height={1.8 * U}
                rx={5}
                fill={
                  uuid && !missing
                    ? `color-mix(in oklab, ${color} 22%, var(--ds-bg))`
                    : 'var(--ds-bg)'
                }
                stroke={missing ? 'var(--ds-danger)' : uuid ? color : 'var(--ds-line-2)'}
                strokeWidth={1.5}
                strokeDasharray={uuid ? undefined : '3 3'}
              />
              <text
                x={bay.at[0] * U}
                y={bay.at[1] * U + 4}
                textAnchor="middle"
                fontSize={10}
                fontWeight={600}
                fill="var(--ds-fg)"
              >
                {bay.label}
              </text>
              <text
                x={bay.at[0] * U}
                y={bay.at[1] * U + U * 1.5}
                textAnchor="middle"
                fontSize={9.5}
                fill={missing ? 'var(--ds-danger)' : 'var(--ds-fg-2)'}
              >
                {model}
              </text>
            </Slot>
          );
        })}
      </svg>
    </div>
  );
}

/** Clickable slot when it references an existing entity. */
function Slot({
  uuid,
  title,
  onNavigate,
  children,
}: {
  uuid: string | null;
  title: string;
  onNavigate: (uuid: string) => void;
  children: ReactNode;
}) {
  if (!uuid) {
    return (
      <g aria-label={title}>
        <title>{title}</title>
        {children}
      </g>
    );
  }
  return (
    <g
      role="link"
      tabIndex={0}
      aria-label={title}
      className="cursor-pointer"
      onClick={() => onNavigate(uuid)}
      onKeyDown={(e) => e.key === 'Enter' && onNavigate(uuid)}
    >
      <title>{title}</title>
      {children}
    </g>
  );
}

function Readouts({
  schematic,
  data,
  label,
  format,
}: {
  schematic: Schematic;
  data: ObjectData;
  label: (key: string) => string;
  format: Intl.NumberFormat;
}) {
  const { t } = useTranslation();
  if (schematic.readouts.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {schematic.readouts.map((readout) => {
        const value = valueAt(data, readout.path);
        if (readout.kind === 'toggle') {
          return (
            <span
              key={readout.path}
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs"
            >
              <span
                className={cn(
                  'size-2 rounded-full',
                  value === true
                    ? 'bg-success'
                    : value === false
                      ? 'bg-fg-3'
                      : 'border border-dashed border-fg-3',
                )}
              />
              {label(readout.label)}
              <MonoText tone="subtle" className="text-[10.5px]">
                {value === true ? t('schematic.on') : value === false ? t('schematic.off') : '—'}
              </MonoText>
            </span>
          );
        }
        const n = number(value);
        const max =
          readout.kind === 'gauge' && readout.max ? number(valueAt(data, readout.max)) : null;
        return (
          <span
            key={readout.path}
            className="inline-flex min-w-[120px] flex-col gap-1 rounded-md border bg-background px-2 py-1 text-xs"
          >
            <span className="flex items-baseline justify-between gap-2">
              {label(readout.label)}
              <MonoText className="font-semibold">
                {n === null ? '—' : format.format(n)} {readout.unit}
              </MonoText>
            </span>
            {readout.kind === 'gauge' && max !== null && max > 0 && n !== null && (
              <span
                className="h-1.5 overflow-hidden rounded-full bg-surface-3"
                title={`max ${format.format(max)}`}
              >
                <span
                  className={cn(
                    'block h-full rounded-full',
                    n > max ? 'bg-destructive' : 'bg-link',
                  )}
                  style={{ width: `${Math.min(100, (n / max) * 100)}%` }}
                />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
