import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { WriteConfirm } from '@/components/molecules/WriteConfirm';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCan } from '@/hooks/useCan';
import { useNpcSwitch } from '@/hooks/useNpcActions';
import { useNpcSettings } from '@/hooks/useNpcs';
import { formatDateTime } from '@/lib/format';
import { writeError } from '@/lib/npcs';

/**
 * The global switch of the NPCs on the servers (ADR 0026) and the counts: total, enabled,
 * running, connected to Horizon. Turning it on or off is confirmed (it connects or disconnects
 * every enabled NPC), for `npc.manage` only; the others see its state.
 */
export function NpcSwitchPanel() {
  const { t, i18n } = useTranslation();
  const can = useCan();
  const settings = useNpcSettings();
  const toggle = useNpcSwitch();
  const [asked, setAsked] = useState<boolean | null>(null);
  const data = settings.data;
  if (!data) return null;
  const on = data.settings.npcsEnabled;

  const confirm = async (next: boolean) => {
    setAsked(null);
    try {
      await toggle.mutateAsync(next);
      toast.success(t(next ? 'npcs.switch.turnedOn' : 'npcs.switch.turnedOff'));
    } catch (error) {
      toast.error(writeError(error, t('npcs.unavailable')));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border px-4 py-3">
      <div className="flex items-center gap-3">
        <Switch
          id="npc-switch"
          checked={on}
          disabled={!can('npc.manage') || toggle.isPending}
          onCheckedChange={(next) => setAsked(next)}
        />
        <Label htmlFor="npc-switch" className="text-sm">
          {t(on ? 'npcs.switch.on' : 'npcs.switch.off')}
        </Label>
      </div>
      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {(['total', 'enabled', 'running', 'connected'] as const).map((key) => (
          <div key={key} className="flex items-baseline gap-1.5">
            <dt className="text-xs text-fg-3">{t(`npcs.counts.${key}`)}</dt>
            <dd className="font-semibold tabular-nums">{data.counts[key]}</dd>
          </div>
        ))}
      </dl>
      <span className="text-xs text-fg-3">
        {t('npcs.switch.changed', {
          date: formatDateTime(data.settings.updatedAt, i18n.language),
          by: data.settings.updatedBy ?? t('npcs.none'),
        })}
      </span>
      {asked !== null && (
        <WriteConfirm
          open
          destructive={!asked}
          title={t(asked ? 'npcs.switch.onTitle' : 'npcs.switch.offTitle')}
          description={
            <p>
              {t(asked ? 'npcs.switch.onText' : 'npcs.switch.offText', {
                count: data.counts.enabled,
              })}
            </p>
          }
          confirmLabel={t(asked ? 'npcs.switch.turnOn' : 'npcs.switch.turnOff')}
          cancelLabel={t('confirm.cancel')}
          onConfirm={() => void confirm(asked)}
          onCancel={() => setAsked(null)}
        />
      )}
    </div>
  );
}
