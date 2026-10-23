import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Poi } from '@dyingstar-admin/contracts/inventory';
import type { MissionObjective } from '@dyingstar-admin/contracts/mission';
import { MissionReward } from '@/components/molecules/MissionReward';
import { ObjectivePlaces } from '@/components/molecules/ObjectivePlaces';
import { RawJson } from '@/components/molecules/RawJson';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { objectiveView, type ObjectiveView } from '@/lib/objectiveSchematics';
import { objectiveInstruction } from '@/lib/objectiveSchematics/instruction';
import { EntityLink } from '@/components/molecules/EntityLink';

interface MissionObjectivesProps {
  objectives: MissionObjective[];
  /** The POIs the objectives point at, from `inventory`; unset when they were not read. */
  places?: Record<string, Poi | null> | undefined;
  /** Display names `social` gave, by player id. */
  players: Record<string, string>;
  /** Opens a player's sheet; unset, players are not links (the account may not see them). */
  onOpenPlayer?: ((id: string) => void) | undefined;
  /** The objective chosen on the mission's map (ADR 0027): its card is framed. */
  selected?: string | undefined;
  /** Chooses an objective with places, to show them on the map; unset, no such choice. */
  onSelect?: ((objectiveId: string | undefined) => void) | undefined;
}

/**
 * A mission's objectives, one card each (ADR 0026), required ones in `mission`'s order then the
 * bonus ones: what the player has to do, its places and goods drawn by its kind's schematic, its
 * progress, weight and bonus reward. A kind the panel does not draw shows its parameters.
 */
export function MissionObjectives({
  objectives,
  places,
  players,
  onOpenPlayer,
  selected,
  onSelect,
}: MissionObjectivesProps) {
  const { t } = useTranslation();
  if (objectives.length === 0) return <p className="text-sm text-fg-3">{t('moderation.none')}</p>;
  const ordered = [...objectives.filter((o) => !o.isBonus), ...objectives.filter((o) => o.isBonus)];
  return (
    <ol className="flex flex-col gap-3">
      {ordered.map((objective) => (
        <li key={objective.id}>
          <ObjectiveCard
            objective={objective}
            view={objectiveView(objective, places)}
            players={players}
            onOpenPlayer={onOpenPlayer}
            selected={selected === objective.id}
            onSelect={onSelect && ((on) => onSelect(on ? objective.id : undefined))}
          />
        </li>
      ))}
    </ol>
  );
}

interface ObjectiveCardProps {
  objective: MissionObjective;
  view: ObjectiveView | null;
  players: Record<string, string>;
  onOpenPlayer?: ((id: string) => void) | undefined;
  selected: boolean;
  onSelect?: ((on: boolean) => void) | undefined;
}

function ObjectiveCard({
  objective: o,
  view,
  players,
  onOpenPlayer,
  selected,
  onSelect,
}: ObjectiveCardProps) {
  const { t, i18n } = useTranslation();
  const hasParams = o.params !== null && Object.keys(o.params).length > 0;
  const placed = view?.places.some((p) => p.poiId) ?? false;
  // Chosen on the map: brought into view.
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selected) card.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [selected]);

  return (
    <article
      ref={card}
      aria-current={selected || undefined}
      className={cn(
        'flex flex-col gap-3 rounded-lg border px-4 py-3',
        selected && 'border-primary ring-1 ring-primary',
      )}
    >
      <header className="flex items-start gap-3">
        {/* Steps are counted from 1 for people; `mission` stores them from 0. */}
        <span
          aria-label={t('missions.objectiveDetail.step', { step: o.order + 1 })}
          className="grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums"
        >
          {o.order + 1}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{o.title}</h3>
            <Badge variant="outline">
              {t(`missions.objectiveTypes.${o.type}` as never, { defaultValue: o.type })}
            </Badge>
            {o.isBonus && <Badge variant="secondary">{t('missions.detail.bonus')}</Badge>}
            {o.isBonus && o.bonusReward && (
              <span className="text-xs">
                <MissionReward rewards={[o.bonusReward]} />
              </span>
            )}
            {!o.isBonus && o.weight !== 1 && (
              <span className="text-xs text-fg-3">
                {t('missions.detail.weight', { count: o.weight })}
              </span>
            )}
          </div>
          {o.description && <p className="text-xs text-fg-3">{o.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline">{t(`missions.objectiveStatus.${o.status}`)}</Badge>
          {placed && onSelect && (
            <Button
              variant={selected ? 'secondary' : 'outline'}
              size="xs"
              aria-pressed={selected}
              onClick={() => onSelect(!selected)}
            >
              {t('missions.placesMap.showOnMap')}
            </Button>
          )}
        </div>
      </header>
      {view ? (
        <div className="flex flex-col gap-2.5 pl-9">
          <p className="text-sm">
            {objectiveInstruction(t, o, view, { language: i18n.language, players })}
          </p>
          {view.playerId && (
            <span className="flex items-center gap-2 text-sm">
              <span className="text-xs text-fg-3">{t('missions.objectivePlaces.passenger')}</span>
              <EntityLink id={view.playerId} label={players[view.playerId]} onOpen={onOpenPlayer} />
            </span>
          )}
          <ObjectivePlaces places={view.places} loaded={view.loaded} />
          <ObjectiveProgress objective={o} view={view} />
        </div>
      ) : (
        <p className="pl-9 text-sm text-fg-3">{t('missions.objectiveDetail.noSchematic')}</p>
      )}
      {hasParams && (
        <details className="pl-9 text-sm" open={!view}>
          <summary className="cursor-pointer text-xs text-fg-3">
            {t('missions.objectiveDetail.parameters')}
          </summary>
          <div className="mt-2">
            <RawJson value={o.params} copyLabel={t('copy.value')} />
          </div>
        </details>
      )}
    </article>
  );
}

/** Progress as its kind reads it: a quantity, a place reached, what is owned, a confirmation. */
function ObjectiveProgress({
  objective: o,
  view,
}: {
  objective: MissionObjective;
  view: ObjectiveView;
}) {
  const { t, i18n } = useTranslation();
  const done = o.status === 'completed';
  const mode = view.schematic.progress;
  if (mode === 'reached' || mode === 'confirmed') {
    const reached = done || o.currentProgress >= o.targetQuantity;
    const key =
      mode === 'reached' ? (reached ? 'reached' : 'notReached') : reached ? 'confirmed' : 'waiting';
    return <p className="text-xs text-fg-2">{t(`missions.objectiveProgress.${key}`)}</p>;
  }
  const target = Math.max(o.targetQuantity, 1);
  const percent = Math.round((Math.min(o.currentProgress, target) / target) * 100);
  const number = new Intl.NumberFormat(i18n.language);
  const value = `${number.format(o.currentProgress)} / ${number.format(o.targetQuantity)}${o.unit ? ` ${o.unit}` : ''}`;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="shrink-0 text-fg-3">{t(`missions.objectiveProgress.${mode}`)}</span>
      <div
        role="progressbar"
        aria-label={o.title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={value}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg-3/25"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}
