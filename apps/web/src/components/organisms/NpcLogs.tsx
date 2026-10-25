import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { ServiceNotice } from '@/components/molecules/ServiceNotice';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useNpcLogs, type LogLevel } from '@/hooks/useNpcs';
import { cn } from '@/lib/cn';
import { npcErrorKey } from '@/lib/npcs';

const ALL = 'all';
const LEVELS: LogLevel[] = ['error', 'warn', 'info', 'debug', 'trace'];
const LEVEL_CLASS: Record<string, string> = {
  ERROR: 'text-destructive',
  WARN: 'text-amber-400',
  INFO: 'text-link',
  DEBUG: 'text-fg-3',
  TRACE: 'text-fg-3',
};

/** A line's fields, compact: `key=value` (values as JSON when not text). */
const compact = (fields: Record<string, unknown>) =>
  Object.entries(fields)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(' ');

/**
 * An NPC's log lines as they come (ADR 0026): the service keeps them in memory (lost when it
 * restarts); the new ones are read every 3 s and appended, at a minimum level. The view follows
 * the last line unless auto-scroll is off; it can be emptied without stopping.
 */
export function NpcLogs({ npcId }: { npcId: string }) {
  const { t, i18n } = useTranslation();
  const [level, setLevel] = useState<LogLevel | undefined>(undefined);
  const [follow, setFollow] = useState(true);
  const logs = useNpcLogs(npcId, level);
  const end = useRef<HTMLLIElement>(null);
  const time = new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  useEffect(() => {
    if (follow) end.current?.scrollIntoView({ block: 'end' });
  }, [logs.lines.length, follow]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <OptionSelect<string>
          label={t('npcs.logs.level')}
          value={level ?? ALL}
          options={[
            { value: ALL, label: t('npcs.logs.allLevels') },
            ...LEVELS.map((l) => ({ value: l, label: t('npcs.logs.atLeast', { level: l }) })),
          ]}
          onChange={(v) => setLevel(v === ALL ? undefined : (v as LogLevel))}
          className="w-44"
        />
        <div className="flex items-center gap-2">
          <Switch id="logs-follow" size="sm" checked={follow} onCheckedChange={setFollow} />
          <Label htmlFor="logs-follow" className="text-xs">
            {t('npcs.logs.follow')}
          </Label>
        </div>
        <Button size="xs" variant="outline" onClick={logs.clear}>
          {t('npcs.logs.clear')}
        </Button>
        <span className="text-xs text-fg-3">
          {t('npcs.logs.count', { count: logs.lines.length })}
        </span>
      </div>
      {logs.isError && <ServiceNotice message={t(npcErrorKey(logs.error))} />}
      <ol
        aria-label={t('npcs.logs.label')}
        className="flex h-96 flex-col overflow-y-auto rounded-lg border bg-surface-2 p-2 font-mono text-2xs"
      >
        {logs.lines.length === 0 && <li className="text-fg-3">{t('npcs.logs.none')}</li>}
        {logs.lines.map((line) => (
          <li key={line.seq} className="flex gap-2 py-0.5 leading-relaxed">
            <span className="shrink-0 text-fg-3">{time.format(new Date(line.ts))}</span>
            <span className={cn('w-10 shrink-0', LEVEL_CLASS[line.level])}>{line.level}</span>
            <span className="min-w-0 break-words">
              {line.message}
              {Object.keys(line.fields).length > 0 && (
                <span className="text-fg-3"> {compact(line.fields)}</span>
              )}
              <span className="text-fg-3"> · {line.target}</span>
            </span>
          </li>
        ))}
        <li ref={end} aria-hidden />
      </ol>
    </div>
  );
}
