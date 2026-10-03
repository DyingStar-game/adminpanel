import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ObjectData } from '@dyingstar-admin/schemas';
import { MonoText } from '@/components/atoms/MonoText';
import type { RefTarget } from '@/components/molecules/UuidLink';
import { cn } from '@/lib/cn';
import { typeColor } from '@/lib/objectTypes';
import { sceneModel, valueAt, type Schematic } from '@/lib/schematics';
import {
  autonomy,
  BATTERY_CAPACITY_J,
  batteryLevel,
  componentModel,
} from '@/lib/schematics/components';

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
      <Readouts
        schematic={schematic}
        data={data}
        label={label}
        format={format}
        resolveRef={resolveRef}
      />
      <svg
        role="img"
        aria-label={label(schematic.title)}
        viewBox={`${-U} ${-U / 2} ${(width + 2) * U} ${(height + 1) * U}`}
        className="mx-auto max-h-110 w-full max-w-80 font-mono"
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
                // Every shape is drawn plain: dashes mean "absent" (empty seat or bay, unknown door).
                fill="var(--ds-bg)"
                stroke="var(--ds-line-2)"
                strokeWidth={1.5}
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
            <Door
              key={door.path}
              hinge={[door.at[0] * U, (door.at[1] - 1) * U]}
              // Doors on the left half swing out to the left, the others to the right.
              side={door.at[0] < width / 2 ? 'left' : 'right'}
              open={open}
              title={`${label(door.label)} · ${t(`schematic.${doorState(open)}`)}`}
            />
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

        {/* Compartment hatches, on the body's edge like the cab doors. */}
        {schematic.bays.map((bay) => {
          if (!bay.hatch) return null;
          const open = valueAt(data, bay.hatch.path);
          return (
            <Door
              key={bay.hatch.path}
              hinge={[bay.hatch.at[0] * U, (bay.hatch.at[1] - 1) * U]}
              side={bay.hatch.at[0] < width / 2 ? 'left' : 'right'}
              open={open}
              title={`${t('schematic.hatch', { bay: bay.label })} · ${t(`schematic.${doorState(open)}`)}`}
            />
          );
        })}

        {schematic.bays.map((bay) => {
          const uuid = reference(valueAt(data, bay.path));
          const target = uuid ? resolveRef(uuid) : null;
          const missing = target?.status === 'missing';
          const found = target?.status === 'found' ? target : null;
          const kind = found ? componentModel(found.scenename) : null;
          const level =
            kind?.kind === 'battery' ? batteryLevel(kind.tier, found?.data?.charge_j) : null;
          const model = kind
            ? `${t(`schematic.kinds.${kind.kind}`)} T${kind.tier}`
            : found
              ? (sceneModel(found.scenename) ?? found.label)
              : missing
                ? t('value.brokenLink')
                : uuid
                  ? '…'
                  : t('schematic.empty');
          // Engines in the component colour; batteries by their charge.
          const color =
            level === null
              ? typeColor('vehicle_component')
              : level > 0.5
                ? 'var(--ds-ok)'
                : level > 0.2
                  ? '#f59e0b'
                  : 'var(--ds-danger)';
          const charge =
            level !== null && kind
              ? ` · ${format.format((level * (BATTERY_CAPACITY_J[kind.tier] ?? 0)) / 1e6)} / ${format.format((BATTERY_CAPACITY_J[kind.tier] ?? 0) / 1e6)} MJ`
              : '';
          const box = 1.8 * U;
          return (
            <Slot
              key={bay.path}
              uuid={missing ? null : uuid}
              onNavigate={onNavigate}
              title={`${bay.label} · ${model}${charge}`}
            >
              <rect
                x={(bay.at[0] - 0.9) * U}
                y={(bay.at[1] - 0.9) * U}
                width={box}
                height={box}
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
              {level !== null && (
                // Charge gauge along the bottom of the compartment.
                <rect
                  x={(bay.at[0] - 0.9) * U + 3}
                  y={(bay.at[1] + 0.9) * U - 6}
                  width={Math.max(0, (box - 6) * level)}
                  height={3}
                  rx={1.5}
                  fill={color}
                />
              )}
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
              {level !== null && (
                <text
                  x={bay.at[0] * U}
                  y={bay.at[1] * U + U * 2.05}
                  textAnchor="middle"
                  fontSize={9.5}
                  fill={color}
                >
                  {Math.round(level * 100)} %
                </text>
              )}
            </Slot>
          );
        })}
      </svg>
    </div>
  );
}

/** Door state from its boolean (absent while the model is not in use). */
const doorState = (value: unknown) =>
  value === true ? 'open' : value === false ? 'closed' : 'unknown';

/** Swing of an open door, in degrees. */
const DOOR_SWING = 55;
/** Length of a door leaf, in pixels. */
const DOOR_LENGTH = 2 * U;

/**
 * Door leaf hinged at its front end on the body side: flush with the body when closed, swung
 * out by `DOOR_SWING` degrees when open, with its swing arc and the opening left in the body.
 */
function Door({
  hinge: [hx, hy],
  side,
  open,
  title,
  length = DOOR_LENGTH,
}: {
  hinge: [number, number];
  side: 'left' | 'right';
  open: unknown;
  title: string;
  /** Leaf length in pixels: a door by default, shorter for a compartment hatch. */
  length?: number;
}) {
  const state = doorState(open);
  // SVG angles turn clockwise: positive swings the free end to the left.
  const angle = state === 'open' ? (side === 'left' ? DOOR_SWING : -DOOR_SWING) : 0;
  const radians = (DOOR_SWING * Math.PI) / 180;
  const endX = hx + (side === 'left' ? -1 : 1) * length * Math.sin(radians);
  const endY = hy + length * Math.cos(radians);
  return (
    <g aria-label={title} data-state={state}>
      <title>{title}</title>
      {state === 'open' && (
        <>
          {/* Opening left in the body, and the path swept by the free end. */}
          <line
            x1={hx}
            y1={hy}
            x2={hx}
            y2={hy + length}
            stroke="var(--ds-ok)"
            strokeWidth={2}
            strokeDasharray="3 3"
          />
          <path
            d={`M ${hx} ${hy + length} A ${length} ${length} 0 0 ${side === 'left' ? 1 : 0} ${endX} ${endY}`}
            fill="none"
            stroke="var(--ds-fg-3)"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        </>
      )}
      <rect
        x={hx - 3}
        y={hy}
        width={6}
        height={length}
        rx={3}
        fill={
          state === 'open' ? 'var(--ds-ok)' : state === 'closed' ? 'var(--ds-fg-3)' : 'transparent'
        }
        stroke="var(--ds-fg-3)"
        strokeDasharray={state === 'unknown' ? '3 3' : undefined}
        className="motion-safe:transition-transform motion-safe:duration-500"
        style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${hx}px ${hy}px` }}
      />
      <circle cx={hx} cy={hy} r={2.5} fill="var(--ds-fg-2)" />
    </g>
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

/** Batteries and engines installed in the bays, for the energy readout. */
function installed(
  schematic: Schematic,
  data: ObjectData,
  resolveRef: (uuid: string) => RefTarget,
) {
  const batteries: { chargeJ: number; capacityJ: number }[] = [];
  const engines: number[] = [];
  for (const bay of schematic.bays) {
    const uuid = reference(valueAt(data, bay.path));
    const target = uuid ? resolveRef(uuid) : null;
    if (target?.status !== 'found') continue;
    const model = componentModel(target.scenename);
    if (model?.kind === 'engine') engines.push(model.tier);
    const capacityJ = model ? BATTERY_CAPACITY_J[model.tier] : undefined;
    const chargeJ = target.data?.charge_j;
    if (model?.kind === 'battery' && capacityJ && typeof chargeJ === 'number') {
      batteries.push({ chargeJ, capacityJ });
    }
  }
  return { batteries, engines };
}

function Readouts({
  schematic,
  data,
  label,
  format,
  resolveRef,
}: {
  schematic: Schematic;
  data: ObjectData;
  label: (key: string) => string;
  format: Intl.NumberFormat;
  resolveRef: (uuid: string) => RefTarget;
}) {
  const { t } = useTranslation();
  if (schematic.readouts.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {schematic.readouts.map((readout) => {
        if (readout.kind === 'energy') {
          const { batteries, engines } = installed(schematic, data, resolveRef);
          const chargeJ = batteries.reduce((sum, b) => sum + b.chargeJ, 0);
          const capacityJ = batteries.reduce((sum, b) => sum + b.capacityJ, 0);
          const range = batteries.length > 0 ? autonomy(chargeJ, engines) : null;
          return (
            <span
              key="energy"
              className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-background px-2 text-xs"
              title={
                batteries.length > 0
                  ? `${format.format(chargeJ / 1e6)} / ${format.format(capacityJ / 1e6)} MJ · ${t('schematic.autonomyHint')}`
                  : undefined
              }
            >
              {label(readout.label)}
              {batteries.length === 0 ? (
                <MonoText tone="subtle">{t('schematic.noBattery')}</MonoText>
              ) : (
                <>
                  <MonoText className="font-semibold">
                    {Math.round((chargeJ / capacityJ) * 100)} %
                  </MonoText>
                  {range && (
                    <MonoText tone="subtle">
                      {t('schematic.autonomy', {
                        minutes: format.format(Math.round(range.seconds / 60)),
                        km: format.format(Math.round(range.metres / 100) / 10),
                      })}
                    </MonoText>
                  )}
                </>
              )}
            </span>
          );
        }
        const value = valueAt(data, readout.path);
        // Every readout is the same chip, aligned on one line.
        const chip =
          'inline-flex h-7 items-center gap-1.5 rounded-md border bg-background px-2 text-xs';
        if (readout.kind === 'toggle') {
          // The dot carries the state (green on, grey off); the word stays for screen readers.
          const state =
            value === true ? t('schematic.on') : value === false ? t('schematic.off') : '—';
          return (
            <span key={readout.path} className={chip} title={`${label(readout.label)} · ${state}`}>
              <span
                aria-hidden
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
              <span className="sr-only">{state}</span>
            </span>
          );
        }
        const n = number(value);
        return (
          <span key={readout.path} className={chip}>
            {label(readout.label)}
            <MonoText className="font-semibold">
              {n === null ? '—' : format.format(n)} {readout.unit}
            </MonoText>
          </span>
        );
      })}
    </div>
  );
}
