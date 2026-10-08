import { useId, useState, type ReactNode } from 'react';
import { BookOpenIcon, XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Item, ObjectData } from '@dyingstar-admin/schemas';
import { Chip } from '@/components/atoms/Chip';
import { MonoText } from '@/components/atoms/MonoText';
import { TypeDot } from '@/components/atoms/TypeDot';
import type { RefTarget } from '@/components/molecules/UuidLink';
import { cn } from '@/lib/cn';
import { itemLabel } from '@/lib/itemLabel';
import { typeColor } from '@/lib/objectTypes';
import { bodyFactList, bodyFacts, factsOfModel, systemOf, wikiUrl } from '@/lib/bodies';
import { sceneModel, valueAt, type Schematic } from '@/lib/schematics';
import {
  autonomy,
  BATTERY_CAPACITY_J,
  batteryLevel,
  componentModel,
  installedEnergy,
  kWh,
  levelColor,
  lookup,
} from '@/lib/schematics/components';
import type { ContentGroup } from '@/lib/schematics/contents';

interface SchematicCardProps {
  schematic: Schematic;
  data: ObjectData;
  resolveRef: (uuid: string) => RefTarget;
  onNavigate: (uuid: string) => void;
  /** Items of the celestial bodies by scene model, to open a body drawn around another. */
  bodies?: ReadonlyMap<string, string> | undefined;
  /** What the item carries (children filling no bay), drawn beside a `cargo` shape. */
  contents?: readonly ContentGroup[] | undefined;
  /** Shows every item carried (a group of several items opens it). */
  onShowContents?: (() => void) | undefined;
}

/** Rows of the contents grid drawn beside a cargo shape, along it. */
const CONTENTS_ROWS = 3;
/** Columns of the contents grid at most; the other contents are counted. */
const MAX_CONTENTS_COLUMNS = 4;
/** Distance between two cells of the contents grid `[column, row]`, in grid units. */
const CONTENTS_STEP: [number, number] = [3.4, 3.2];

/** Pixels per grid unit of a schematic. */
const U = 22;
/** Length of a lit headlight's small cone, within the margin above the drawing. */
const CONE_LENGTH = 0.45 * U;
const number = (value: unknown) => (typeof value === 'number' ? value : null);
const reference = (value: unknown) => (typeof value === 'string' && value !== '' ? value : null);
const stringOf = (value: unknown) => (typeof value === 'string' ? value : null);

/** Generic renderer of a declarative scene schematic (ADR 0016), bound to live data. */
export function SchematicCard({
  schematic,
  data,
  resolveRef,
  onNavigate,
  bodies = new Map(),
  contents = [],
  onShowContents,
}: SchematicCardProps) {
  const { t, i18n } = useTranslation();
  const label = (key: string) =>
    t(`schematic.labels.${key}` as 'schematic.labels.cab', { defaultValue: key });
  const format = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });
  const [width, height] = schematic.size;
  const cargo = contents.length > 0 ? schematic.shapes.find((shape) => shape.contents) : undefined;
  // A group of several items clicked: its items listed under the drawing.
  const [detail, setDetail] = useState<string | null>(null);
  const opened = contents.find((group) => group.key === detail && group.items.length > 1);
  // The contents grid widens the drawing to the right: the callout, then its columns.
  const columns = Math.min(MAX_CONTENTS_COLUMNS, Math.ceil(contents.length / CONTENTS_ROWS));
  const extra = cargo ? 1.6 + columns * CONTENTS_STEP[0] : 0;
  const celestial = schematic.shapes.some((shape) => shape.kind === 'celestial');
  const body = celestial ? bodyFacts(data.scenename) : null;
  // A planet orbits the star: a link to it (moons show their planet in the drawing).
  const starFacts = factsOfModel('star');
  const starUuid = bodies.get('star');
  const orbited =
    body && starFacts && starUuid && /^tarsis_\d+$/.test(sceneModel(data.scenename) ?? '')
      ? { uuid: starUuid, facts: starFacts }
      : null;

  return (
    <div className="flex flex-col gap-3">
      {body && (
        // The body's facts in chips, like the truck's readouts, and its wiki page.
        <div className="flex flex-wrap items-center gap-2">
          <Chip>
            <span className="font-semibold">{body.name ?? body.designation}</span>
            {body.name && <MonoText tone="subtle">{body.designation}</MonoText>}
          </Chip>
          {orbited && (
            // The star a planet orbits (persistence links them only implicitly, ADR 0008).
            <Chip variant="link" onClick={() => onNavigate(orbited.uuid)}>
              {t('body.star')}
              <span className="font-semibold">{orbited.facts.designation}</span>
            </Chip>
          )}
          {bodyFactList(body).map((fact) => (
            <Chip key={fact.key}>
              {t(`body.${fact.key}`)}
              <MonoText className="font-semibold">
                {format.format(fact.value)} {fact.unit === 'd' ? t('body.days') : fact.unit}
              </MonoText>
            </Chip>
          ))}
          {typeof data.soi === 'number' && (
            // Persistence's own value: where the body's gravity prevails over the star's.
            <Chip title={t('body.soiHint')}>
              {t('body.soi')}
              <MonoText className="font-semibold">{format.format(data.soi / 1000)} km</MonoText>
            </Chip>
          )}
          <a
            href={wikiUrl(body)}
            target="_blank"
            rel="noreferrer"
            title={t('body.wikiHint')}
            className="ml-auto inline-flex items-center gap-1 text-xs text-link hover:underline"
          >
            <BookOpenIcon size={13} />
            {t('body.wiki')}
          </a>
        </div>
      )}
      <Readouts
        schematic={schematic}
        data={data}
        label={label}
        format={format}
        resolveRef={resolveRef}
      />
      {/* A group's list goes under the drawing: opening it never moves nor shrinks the drawing. */}
      <div className="flex flex-col gap-3">
        <svg
          role="img"
          aria-label={label(schematic.title)}
          viewBox={`${-U} ${-U / 2} ${(width + 2 + extra) * U} ${(height + 1) * U}`}
          // The drawing keeps its scale when contents widen it.
          style={cargo ? { maxWidth: `${(20 * (width + 2 + extra)) / (width + 2)}rem` } : undefined}
          className={cn(
            'mx-auto w-full font-mono',
            // Celestial bodies are drawn with their system: the card's whole width.
            celestial ? 'max-h-150 max-w-200' : 'max-h-110 max-w-80',
          )}
        >
          {schematic.shapes.map((shape) => {
            const value = shape.value ? number(valueAt(data, shape.value.path)) : null;
            if (shape.kind === 'celestial') {
              return (
                <CelestialDiagram
                  key={shape.label}
                  at={shape.at}
                  size={shape.size}
                  scenename={data.scenename}
                  format={format}
                  bodies={bodies}
                  onNavigate={onNavigate}
                />
              );
            }
            if (shape.kind === 'battery') {
              const model = componentModel(data.scenename);
              return (
                <BatteryCell
                  key={shape.label}
                  at={shape.at}
                  size={shape.size}
                  chargeJ={value}
                  capacityJ={model ? BATTERY_CAPACITY_J[model.tier] : undefined}
                  label={label(shape.label)}
                  format={format}
                />
              );
            }
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

          {schematic.lights.map((light) => {
            const on = valueAt(data, light.path);
            const state = on === true ? t('schematic.on') : on === false ? t('schematic.off') : '—';
            return (
              <Light
                key={light.label}
                at={[light.at[0] * U, light.at[1] * U]}
                on={on === true}
                title={`${label(light.label)} · ${state}`}
              />
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
            return (
              <ComponentSlot
                key={bay.path}
                at={bay.at}
                label={bay.label}
                uuid={uuid}
                target={uuid ? resolveRef(uuid) : null}
                format={format}
                onNavigate={onNavigate}
              />
            );
          })}

          {cargo && (
            <Contents
              shape={cargo}
              edge={width - 1}
              contents={contents}
              format={format}
              onNavigate={onNavigate}
              onShowContents={onShowContents}
              selected={opened?.key ?? null}
              onSelect={(key) => setDetail((current) => (current === key ? null : key))}
            />
          )}
        </svg>
        {opened && (
          <ContentDetail
            group={opened}
            format={format}
            onNavigate={onNavigate}
            onClose={() => setDetail(null)}
          />
        )}
      </div>
    </div>
  );
}

/**
 * What a cargo shape carries, drawn beside the schematic in a grid joined to the shape by a
 * callout line and a bracket (positions in the shape are not drawn): rocks and other items
 * grouped by type (all the mined rocks in one box) with their count and total weight, and each
 * engine or battery laid loose drawn like an installed one, its weight inside. A group of one
 * item opens it; a group of several shows them all.
 */
function Contents({
  shape,
  edge,
  contents,
  format,
  onNavigate,
  onShowContents,
  selected,
  onSelect,
}: {
  shape: Schematic['shapes'][number];
  /** Right edge of the drawing, where the callout line bends, in grid units. */
  edge: number;
  contents: readonly ContentGroup[];
  format: Intl.NumberFormat;
  onNavigate: (uuid: string) => void;
  onShowContents: (() => void) | undefined;
  /** Key of the group listed under the drawing, if any. */
  selected: string | null;
  /** Lists a group of several items under the drawing (again: hides the list). */
  onSelect: (key: string) => void;
}) {
  const { t } = useTranslation();
  const shown = contents.slice(0, CONTENTS_ROWS * MAX_CONTENTS_COLUMNS);
  const more = contents.length - shown.length;
  const count = contents.reduce((sum, group) => sum + group.items.length, 0);
  const rows = Math.min(CONTENTS_ROWS, shown.length);
  const box = 1.8 * U;
  // Anchor inside the shape, by its right side, under its label and load.
  const anchor: [number, number] = [
    (shape.at[0] + shape.size[0] - 0.8) * U,
    (shape.at[1] + shape.size[1] / 2 + 0.4) * U,
  ];
  const bend = (edge + 0.2) * U;
  const bracket = (edge + 1.1) * U;
  const cell = (i: number): [number, number] => [
    edge + 2.6 + Math.floor(i / CONTENTS_ROWS) * CONTENTS_STEP[0],
    shape.at[1] + 1.4 + (i % CONTENTS_ROWS) * CONTENTS_STEP[1],
  ];
  const top = cell(0)[1] * U - box / 2;
  const bottom = cell(rows - 1)[1] * U + box / 2;
  const mass = (kg: number) => massText(kg, format);
  return (
    <g aria-label={t('schematic.contents', { count })}>
      <circle cx={anchor[0]} cy={anchor[1]} r={2.5} fill="var(--ds-fg-3)" />
      {/* Callout line from the shape to a bracket along the contents. */}
      <path
        aria-hidden
        d={`M ${anchor[0]} ${anchor[1]} H ${bend} V ${(top + bottom) / 2} H ${bracket - 6} M ${bracket} ${top} H ${bracket - 6} V ${bottom} H ${bracket}`}
        fill="none"
        stroke="var(--ds-fg-3)"
        strokeWidth={1}
        strokeDasharray="2 3"
      />
      {shown.map((group, i) => {
        const [x, y] = cell(i);
        const weight = group.weight === null ? null : mass(group.weight);
        const single = group.items.length === 1 ? group.items[0] : undefined;
        if (group.component && single) {
          return (
            <ComponentSlot
              key={group.key}
              at={[x, y]}
              label={weight ?? '—'}
              title={itemLabel(single)}
              uuid={single.object_uuid}
              target={{
                status: 'found',
                label: itemLabel(single),
                objectType: single.object_type,
                scenename: stringOf(single.object_data.scenename),
                data: single.object_data,
              }}
              format={format}
              onNavigate={onNavigate}
            />
          );
        }
        const color = typeColor(group.objectType);
        const name = groupName(group, t('schematic.ore'));
        const isSelected = group.key === selected;
        return (
          <ContentBox
            key={group.key}
            title={`${group.items.length} × ${name}${weight ? ` · ${weight}` : ''}`}
            onOpen={single ? () => onNavigate(single.object_uuid) : () => onSelect(group.key)}
          >
            <rect
              x={(x - 0.9) * U}
              y={y * U - box / 2}
              width={box}
              height={box}
              rx={5}
              fill={`color-mix(in oklab, ${color} 22%, var(--ds-bg))`}
              stroke={isSelected ? 'var(--ds-acc)' : color}
              strokeWidth={isSelected ? 2.5 : 1.5}
            />
            <text
              x={x * U}
              y={weight ? y * U + 1 : y * U + 4}
              textAnchor="middle"
              fontSize={10}
              fontWeight={600}
              fill="var(--ds-fg)"
            >
              ×{group.items.length}
            </text>
            {weight && (
              <text x={x * U} y={y * U + 12} textAnchor="middle" fontSize={8} fill="var(--ds-fg-2)">
                {weight}
              </text>
            )}
            <text
              x={x * U}
              y={y * U + U * 1.5}
              textAnchor="middle"
              fontSize={9.5}
              fill="var(--ds-fg-2)"
            >
              {name}
            </text>
          </ContentBox>
        );
      })}
      {more > 0 && (
        <ContentBox title={t('schematic.moreContents', { count: more })} onOpen={onShowContents}>
          <text
            x={cell(0)[0] * U - box / 2}
            y={bottom + U * 1.6}
            fontSize={9.5}
            fill="var(--ds-fg-3)"
          >
            {t('schematic.moreContents', { count: more })}
          </text>
        </ContentBox>
      )}
    </g>
  );
}

/** Mass in kilograms, in tonnes from 1,000 kg. */
const massText = (kg: number, format: Intl.NumberFormat) =>
  kg >= 1000 ? `${format.format(kg / 1000)} t` : `${format.format(Math.round(kg))} kg`;

/** Name of a content group: ore (its label given) for mined rocks, else its type. */
const groupName = (group: ContentGroup, ore: string) =>
  group.objectType === 'miningrock' ? ore : group.objectType;

/**
 * Items of a content group, listed under the drawing: rocks by mineral (each with its count and
 * weight), heaviest first; each line opens its item (name, host rock, weight).
 */
function ContentDetail({
  group,
  format,
  onNavigate,
  onClose,
}: {
  group: ContentGroup;
  format: Intl.NumberFormat;
  onNavigate: (uuid: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const name = groupName(group, t('schematic.ore'));
  const weightOf = (item: Item) =>
    typeof item.object_data.weight === 'number' ? item.object_data.weight : null;
  const sections = new Map<string, Item[]>();
  for (const item of group.items) {
    const mineral = stringOf(item.object_data.mineral_id) ?? '';
    sections.set(mineral, [...(sections.get(mineral) ?? []), item]);
  }
  const total = (items: Item[]) => items.reduce((sum, item) => sum + (weightOf(item) ?? 0), 0);
  const sorted = [...sections.entries()]
    .map(([mineral, items]) => ({
      mineral,
      items: items.sort((a, b) => (weightOf(b) ?? 0) - (weightOf(a) ?? 0)),
      weight: total(items),
    }))
    .sort((a, b) => b.weight - a.weight || a.mineral.localeCompare(b.mineral));
  return (
    <section
      aria-label={t('schematic.contentsOf', { name })}
      className="flex flex-col gap-1 rounded-xl border bg-surface-2 p-2"
    >
      <header className="flex items-center gap-2 px-2 py-1">
        <TypeDot objectType={group.objectType} />
        <span className="text-sm font-semibold">
          {group.items.length} × {name}
        </span>
        {group.weight !== null && (
          <MonoText tone="subtle" className="text-xs">
            {massText(group.weight, format)}
          </MonoText>
        )}
        <button
          type="button"
          aria-label={t('orbit.close')}
          onClick={onClose}
          className="ml-auto rounded-md p-1 text-fg-3 hover:bg-fg-3/10 hover:text-fg"
        >
          <XIcon size={14} />
        </button>
      </header>
      <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
        {sorted.map((section) => {
          const mineral = section.mineral
            ? t(`schematic.minerals.${section.mineral}` as 'schematic.minerals.gold', {
                defaultValue: section.mineral,
              })
            : null;
          return (
            <div key={section.mineral} role="group" aria-label={mineral ?? name}>
              {mineral && (
                <div className="flex items-baseline gap-2 px-2 pt-1 text-xs">
                  <span className="font-semibold text-fg-2">{mineral}</span>
                  <MonoText tone="subtle">
                    {section.items.length} · {massText(section.weight, format)}
                  </MonoText>
                </div>
              )}
              <ul>
                {section.items.map((item) => {
                  const weight = weightOf(item);
                  const host = stringOf(item.object_data.host_rock_id);
                  return (
                    <li key={item.object_uuid}>
                      <button
                        type="button"
                        onClick={() => onNavigate(item.object_uuid)}
                        className="flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left hover:bg-fg-3/10"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-link">
                          {itemLabel(item)}
                        </span>
                        {host && (
                          <MonoText tone="subtle" className="truncate text-2xs">
                            {host}
                          </MonoText>
                        )}
                        <MonoText className="text-xs whitespace-nowrap">
                          {weight === null ? '—' : massText(weight, format)}
                        </MonoText>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** A content box, a link when it opens something. */
function ContentBox({
  title,
  onOpen,
  children,
}: {
  title: string;
  onOpen: (() => void) | undefined;
  children: ReactNode;
}) {
  if (!onOpen) {
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
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
      <title>{title}</title>
      {children}
    </g>
  );
}

/**
 * A vehicle component in a box, as installed in a bay or laid loose in the bed: kind and tier
 * below, a battery's charge as a gauge and a percentage, a broken reference in red, dashed when
 * empty. `label` is written inside (the bay, or a loose component's weight).
 */
function ComponentSlot({
  at: [x, y],
  label,
  title,
  uuid,
  target,
  format,
  onNavigate,
}: {
  at: [number, number];
  label: string;
  /** Tooltip head, `label` by default. */
  title?: string;
  uuid: string | null;
  target: RefTarget | null;
  format: Intl.NumberFormat;
  onNavigate: (uuid: string) => void;
}) {
  const { t } = useTranslation();
  const missing = target?.status === 'missing';
  const found = target?.status === 'found' ? target : null;
  const kind = found ? componentModel(found.scenename) : null;
  const level = kind?.kind === 'battery' ? batteryLevel(kind.tier, found?.data?.charge_j) : null;
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
  const color = level === null ? typeColor('vehicle_component') : levelColor(level);
  const capacityJ = kind ? (BATTERY_CAPACITY_J[kind.tier] ?? 0) : 0;
  const charge =
    level !== null
      ? ` · ${format.format(kWh(level * capacityJ))} / ${format.format(kWh(capacityJ))} kWh`
      : '';
  const box = 1.8 * U;
  return (
    <Slot
      uuid={missing ? null : uuid}
      onNavigate={onNavigate}
      title={`${title ?? label} · ${model}${charge}`}
    >
      <rect
        x={(x - 0.9) * U}
        y={(y - 0.9) * U}
        width={box}
        height={box}
        rx={5}
        fill={uuid && !missing ? `color-mix(in oklab, ${color} 22%, var(--ds-bg))` : 'var(--ds-bg)'}
        stroke={missing ? 'var(--ds-danger)' : uuid ? color : 'var(--ds-line-2)'}
        strokeWidth={1.5}
        strokeDasharray={uuid ? undefined : '3 3'}
      />
      {level !== null && (
        // Charge gauge along the bottom of the compartment.
        <rect
          x={(x - 0.9) * U + 3}
          y={(y + 0.9) * U - 6}
          width={Math.max(0, (box - 6) * level)}
          height={3}
          rx={1.5}
          fill={color}
        />
      )}
      <text
        x={x * U}
        y={y * U + 4}
        textAnchor="middle"
        fontSize={10}
        fontWeight={600}
        fill="var(--ds-fg)"
      >
        {label}
      </text>
      <text
        x={x * U}
        y={y * U + U * 1.5}
        textAnchor="middle"
        fontSize={9.5}
        fill={missing ? 'var(--ds-danger)' : 'var(--ds-fg-2)'}
      >
        {model}
      </text>
      {level !== null && (
        <text x={x * U} y={y * U + U * 2.05} textAnchor="middle" fontSize={9.5} fill={color}>
          {Math.round(level * 100)} %
        </text>
      )}
    </Slot>
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

/**
 * A light on the body's front edge: a lens, and when on a cone of light widening ahead of it and
 * fading out; dimmed lens when off.
 */
function Light({ at: [x, y], on, title }: { at: [number, number]; on: boolean; title: string }) {
  const gradient = useId();
  const lens = 0.9 * U;
  const spread = 0.25 * U;
  return (
    <g aria-label={title} data-state={on ? 'on' : 'off'}>
      <title>{title}</title>
      {on && (
        <>
          <defs>
            <linearGradient id={gradient} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="var(--ds-acc)" stopOpacity={0.6} />
              <stop offset="1" stopColor="var(--ds-acc)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path
            aria-hidden
            d={`M ${x - lens / 2} ${y} L ${x - lens / 2 - spread} ${y - CONE_LENGTH} L ${x + lens / 2 + spread} ${y - CONE_LENGTH} L ${x + lens / 2} ${y} Z`}
            fill={`url(#${gradient})`}
          />
        </>
      )}
      <rect
        x={x - lens / 2}
        y={y - 2}
        width={lens}
        height={5}
        rx={2.5}
        fill={on ? 'var(--ds-acc)' : 'var(--ds-fg-3)'}
        stroke={on ? 'var(--ds-acc)' : 'var(--ds-line-2)'}
      />
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

/**
 * A body in its system, from the wiki facts: the star with its planets, a planet with its moons,
 * a moon in its planet's system (itself highlighted and pulsing). Only names are drawn: the
 * facts are in the chips above. Bodies around sit on their orbits, innermost first, sized to
 * their radius against the largest; each one with an item opens it.
 */
function CelestialDiagram({
  at,
  size,
  scenename,
  format,
  bodies,
  onNavigate,
}: {
  at: [number, number];
  size: [number, number];
  scenename: unknown;
  format: Intl.NumberFormat;
  bodies: ReadonlyMap<string, string>;
  onNavigate: (uuid: string) => void;
}) {
  const { t } = useTranslation();
  const system = systemOf(scenename);
  const centre = system ? factsOfModel(system.centre) : null;
  const cx = (at[0] + size[0] / 2) * U;
  const cy = (at[1] + size[1] / 2) * U;
  if (!system || !centre) {
    return (
      <text x={cx} y={cy} textAnchor="middle" fontSize={11} fill="var(--ds-fg-3)">
        {t('schematic.noFacts')}
      </text>
    );
  }
  const around = system.around.flatMap((model) => {
    const facts = factsOfModel(model);
    return facts ? [{ model, facts }] : [];
  });
  const isStar = centre.temperatureK !== undefined;
  const color = isStar ? '#f59e0b' : typeColor('planet');
  const outer = (Math.min(size[0], size[1]) / 2) * U - 8;
  const r0 = around.length > 0 ? 2.4 * U : 3.2 * U;
  const first = r0 + 1.1 * U;
  const step = around.length > 1 ? (outer - first) / (around.length - 1) : 0;
  const largest = Math.max(...around.map((a) => a.facts.radiusKm), 1);
  const km = (value: number) => `${format.format(value)} km`;
  const open = (model: string) => {
    const uuid = bodies.get(model);
    return uuid && model !== system.current ? () => onNavigate(uuid) : undefined;
  };
  const centreOpen = open(system.centre);

  return (
    <g aria-label={centre.designation}>
      {around.map(({ model, facts }, i) => {
        const orbit = first + i * step;
        const angle = ((-20 + i * (330 / Math.max(around.length, 1))) * Math.PI) / 180;
        const mx = cx + orbit * Math.cos(angle);
        const my = cy + orbit * Math.sin(angle);
        const mr = 3 + (0.6 * U - 3) * Math.sqrt(facts.radiusKm / largest);
        const right = Math.cos(angle) >= 0;
        const current = model === system.current;
        const onClick = open(model);
        const name = facts.name ?? facts.designation.replace(/^.*\./, '');
        return (
          <g key={model}>
            <circle
              cx={cx}
              cy={cy}
              r={orbit}
              fill="none"
              stroke={current ? 'var(--ds-acc)' : 'var(--ds-line-2)'}
              strokeDasharray="2 4"
            />
            <g
              role={onClick ? 'link' : undefined}
              aria-label={onClick ? name : undefined}
              tabIndex={onClick ? 0 : undefined}
              onClick={onClick}
              onKeyDown={(event) => event.key === 'Enter' && onClick?.()}
              className={
                onClick ? 'cursor-pointer [&:hover_circle]:stroke-[var(--ds-acc)]' : undefined
              }
            >
              <title>
                {[
                  facts.name ? `${facts.name} · ${facts.designation}` : facts.designation,
                  km(facts.radiusKm),
                  facts.orbitDays !== undefined ? `${format.format(facts.orbitDays)} d` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </title>
              {current && (
                // The body on screen pulses, like a selection on the orbit view.
                <circle
                  aria-hidden
                  cx={mx}
                  cy={my}
                  r={mr}
                  fill="var(--ds-acc)"
                  fillOpacity={0.35}
                  className="origin-center motion-safe:animate-ping"
                  style={{ transformBox: 'fill-box' }}
                />
              )}
              <circle
                cx={mx}
                cy={my}
                r={mr}
                fill={
                  current ? `color-mix(in oklab, ${color} 45%, var(--ds-bg))` : 'var(--ds-fg-3)'
                }
                stroke={current ? 'var(--ds-acc)' : 'var(--ds-bg)'}
                strokeWidth={current ? 2 : 1}
              />
              <text
                x={mx + (right ? mr + 5 : -mr - 5)}
                y={my + 4}
                textAnchor={right ? 'start' : 'end'}
                fontSize={11}
                fontWeight={current ? 600 : 400}
                fill={current ? 'var(--ds-fg)' : 'var(--ds-fg-2)'}
              >
                {name}
              </text>
            </g>
          </g>
        );
      })}
      <g
        role={centreOpen ? 'link' : undefined}
        aria-label={centreOpen ? (centre.name ?? centre.designation) : undefined}
        tabIndex={centreOpen ? 0 : undefined}
        onClick={centreOpen}
        onKeyDown={(event) => event.key === 'Enter' && centreOpen?.()}
        className={centreOpen ? 'cursor-pointer' : undefined}
      >
        <title>{[centre.designation, centre.name].filter(Boolean).join(' · ')}</title>
        {system.centre === system.current && (
          // The body on screen pulses, like a moon: a ring growing out of the disc (a scaled
          // copy of a disc this size would cover the orbits).
          <circle
            aria-hidden
            cx={cx}
            cy={cy}
            r={r0}
            fill="none"
            stroke="var(--ds-acc)"
            strokeWidth={2}
            className="motion-reduce:hidden"
          >
            <animate
              attributeName="r"
              values={`${r0};${r0 + 14}`}
              dur="1.6s"
              repeatCount="indefinite"
            />
            <animate attributeName="opacity" values="0.7;0" dur="1.6s" repeatCount="indefinite" />
          </circle>
        )}
        <circle
          cx={cx}
          cy={cy}
          r={r0}
          fill={`color-mix(in oklab, ${color} ${isStar ? 55 : 30}%, var(--ds-bg))`}
          stroke={system.centre === system.current ? 'var(--ds-acc)' : color}
          strokeWidth={system.centre === system.current ? 2 : 1.5}
        />
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fontSize={13}
          fontWeight={600}
          fill="var(--ds-fg)"
        >
          {centre.name ?? centre.designation}
        </text>
        {centre.name && (
          <text x={cx} y={cy + 13} textAnchor="middle" fontSize={11} fill="var(--ds-fg-2)">
            {centre.designation}
          </text>
        )}
      </g>
    </g>
  );
}

/**
 * A battery cell drawn as a progress bar: outline with its terminal, filled to the charge, the
 * charge in kWh and its share of the capacity written over it.
 */
function BatteryCell({
  at,
  size,
  chargeJ,
  capacityJ,
  label,
  format,
}: {
  at: [number, number];
  size: [number, number];
  chargeJ: number | null;
  capacityJ: number | undefined;
  label: string;
  format: Intl.NumberFormat;
}) {
  const level =
    chargeJ !== null && capacityJ ? Math.min(1, Math.max(0, chargeJ / capacityJ)) : null;
  const [x, y, w, h] = [at[0] * U, at[1] * U, size[0] * U, size[1] * U];
  const pad = 4;
  const text =
    chargeJ === null
      ? '—'
      : capacityJ
        ? `${format.format(kWh(chargeJ))} / ${format.format(kWh(capacityJ))} kWh`
        : `${format.format(kWh(chargeJ))} kWh`;
  return (
    <g
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={level === null ? undefined : Math.round(level * 100)}
      aria-valuetext={text}
    >
      <title>{`${label} · ${text}`}</title>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        fill="var(--ds-bg)"
        stroke="var(--ds-line-2)"
        strokeWidth={1.5}
      />
      {/* Positive terminal. */}
      <rect x={x + w} y={y + h / 3} width={U / 2} height={h / 3} rx={3} fill="var(--ds-line-2)" />
      {level !== null && (
        <rect
          x={x + pad}
          y={y + pad}
          width={Math.max(0, (w - 2 * pad) * level)}
          height={h - 2 * pad}
          rx={5}
          fill={`color-mix(in oklab, ${levelColor(level)} 45%, var(--ds-bg))`}
          stroke={levelColor(level)}
          strokeWidth={1}
        />
      )}
      <text
        x={x + w / 2}
        y={y + h / 2 - 3}
        textAnchor="middle"
        fontSize={16}
        fontWeight={600}
        fill="var(--ds-fg)"
      >
        {level === null ? '—' : `${Math.round(level * 100)} %`}
      </text>
      <text x={x + w / 2} y={y + h / 2 + 15} textAnchor="middle" fontSize={11} fill="var(--ds-fg)">
        {text}
      </text>
    </g>
  );
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
          const { chargeJ, capacityJ, batteries, engines } = installedEnergy(
            schematic,
            data,
            lookup(resolveRef),
          );
          const range = batteries > 0 ? autonomy(chargeJ, engines) : null;
          return (
            <Chip
              key="energy"
              title={
                batteries > 0
                  ? `${format.format(kWh(chargeJ))} / ${format.format(kWh(capacityJ))} kWh · ${t('schematic.autonomyHint')}`
                  : undefined
              }
            >
              {label(readout.label)}
              {batteries === 0 ? (
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
            </Chip>
          );
        }
        const value = valueAt(data, readout.path);
        if (readout.kind === 'toggle') {
          // The dot carries the state (green on, grey off); the word stays for screen readers.
          const state =
            value === true ? t('schematic.on') : value === false ? t('schematic.off') : '—';
          return (
            // Every readout is the same chip, aligned on one line.
            <Chip key={readout.path} title={`${label(readout.label)} · ${state}`}>
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
            </Chip>
          );
        }
        const n = number(value);
        return (
          <Chip key={readout.path}>
            {label(readout.label)}
            <MonoText className="font-semibold">
              {n === null ? '—' : format.format(n)} {readout.unit}
            </MonoText>
          </Chip>
        );
      })}
    </div>
  );
}
