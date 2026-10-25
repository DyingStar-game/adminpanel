import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { MonoText } from '@/components/atoms/MonoText';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { ScheduleGrid } from '@/components/molecules/ScheduleGrid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/useCan';
import { usePatchNpc } from '@/hooks/useNpcActions';
import { usePatterns, useScheduleLegend } from '@/hooks/useNpcs';
import { currentCell, writeError, type NpcDetail } from '@/lib/npcs';

const NONE = '__none__';

interface NpcRoutineCardProps {
  detail: NpcDetail;
  /** Opens the pattern in the routines editor. */
  onEditPattern: (name: string) => void;
}

/**
 * An NPC's routine (ADR 0026): the planetary time on its planet, its pattern's week as a grid
 * with the cell of now outlined (the rota day wraps over the pattern's days), the activity now
 * and the actions it allows. `npc.manage` changes the pattern (or clears it: no schedule
 * gating); the pattern opens in the routines editor.
 */
export function NpcRoutineCard({ detail, onEditPattern }: NpcRoutineCardProps) {
  const { t } = useTranslation();
  const can = useCan();
  const patterns = usePatterns();
  const legend = useScheduleLegend();
  const patch = usePatchNpc();
  const { npc, routine } = detail;
  const letters = legend.data?.letters ?? [];
  const meaning = (letter: string) =>
    letters.find((l) => l.letter === letter)?.label ?? t('npcs.patterns.unknownLetter');

  const change = async (value: string) => {
    const schedulePattern = value === NONE ? null : value;
    try {
      await patch.mutateAsync({ id: npc.id, patch: { schedulePattern } });
      toast.success(t('npcs.routine.changed'));
    } catch (error) {
      toast.error(writeError(error, t('npcs.unavailable')));
    }
  };

  const cell = routine ? currentCell(routine) : null;
  const hours = legend.data?.hoursPerDay ?? routine?.days?.[0]?.length ?? 25;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {can('npc.manage') ? (
          <OptionSelect<string>
            size="default"
            label={t('npcs.fields.schedulePattern')}
            value={npc.schedulePattern ?? NONE}
            options={[
              { value: NONE, label: t('npcs.routine.noPattern') },
              ...(patterns.data?.items ?? []).map((p) => ({ value: p.name, label: p.name })),
              // A pattern set but unknown to the service stays shown.
              ...(npc.schedulePattern &&
              !(patterns.data?.items ?? []).some((p) => p.name === npc.schedulePattern)
                ? [{ value: npc.schedulePattern, label: npc.schedulePattern }]
                : []),
            ]}
            onChange={(v) => void change(v)}
            className="w-60"
          />
        ) : (
          <span className="text-sm">
            {t('npcs.fields.schedulePattern')}:{' '}
            <MonoText>{npc.schedulePattern ?? t('npcs.routine.noPattern')}</MonoText>
          </span>
        )}
        {npc.schedulePattern && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEditPattern(npc.schedulePattern ?? '')}
          >
            {t('npcs.routine.edit')}
          </Button>
        )}
      </div>
      {routine ? (
        <>
          {routine.patternMissing && (
            <p role="alert" className="text-sm text-destructive">
              {t('npcs.routine.missing', { pattern: routine.pattern ?? '' })}
            </p>
          )}
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-2xs tracking-wider text-fg-3 uppercase">
                {t('npcs.routine.time')}
              </dt>
              <dd>
                {t('npcs.routine.clock', {
                  planet: routine.planet,
                  day: routine.day + 1,
                  hour: routine.hour,
                  rotation: routine.rotationH,
                })}
              </dd>
            </div>
            <div>
              <dt className="text-2xs tracking-wider text-fg-3 uppercase">
                {t('npcs.routine.activity')}
              </dt>
              <dd>
                {routine.activity ? t(`npcs.activities.${routine.activity}`) : t('npcs.none')}
              </dd>
            </div>
            <div className="min-w-0 flex-1">
              <dt className="text-2xs tracking-wider text-fg-3 uppercase">
                {t('npcs.routine.allowed')}
              </dt>
              <dd className="flex flex-wrap gap-1">
                {routine.allowedActions === null ? (
                  <span className="text-fg-3">{t('npcs.routine.noGating')}</span>
                ) : (
                  routine.allowedActions.map((a) => (
                    <Badge key={a} variant="outline" className="font-mono">
                      {a}
                    </Badge>
                  ))
                )}
              </dd>
            </div>
          </dl>
          {routine.days?.length ? (
            <div className="overflow-x-auto">
              <ScheduleGrid
                days={routine.days}
                hours={hours}
                label={t('npcs.routine.grid', { pattern: routine.pattern ?? '' })}
                dayLabel={(day) => t('npcs.patterns.day', { day: day + 1 })}
                letterLabel={meaning}
                cellLabel={(day, hour, what) =>
                  t('npcs.patterns.cell', { day: day + 1, hour, meaning: what })
                }
                current={cell}
              />
            </div>
          ) : (
            <p className="text-sm text-fg-3">{t('npcs.routine.noGrid')}</p>
          )}
        </>
      ) : (
        <p className="text-sm text-fg-3">{t('npcs.routine.unavailable')}</p>
      )}
    </div>
  );
}
