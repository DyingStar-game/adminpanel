import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { MissionDetailAsServed } from '@dyingstar-admin/contracts/mission';
import { Chip } from '@/components/atoms/Chip';
import { MonoText } from '@/components/atoms/MonoText';
import { FactList } from '@/components/molecules/FactList';
import { Badge } from '@/components/ui/badge';
import { formatAmount } from '@/lib/economy';
import { formatDateTime } from '@/lib/format';
import { EntityLink } from '@/components/molecules/EntityLink';
import { IdLabel } from '@/components/molecules/IdLabel';
import { HolderLink } from './HolderLink';

/** Ways to the pages of what a mission refers to; unset, the reference is shown as an id. */
export interface MissionLinks {
  onOpenMission: (id: string) => void;
  onOpenPlayer?: ((id: string) => void) | undefined;
  onOpenCorporation?: ((id: string) => void) | undefined;
  onOpenPoliticalEntity?: ((id: string) => void) | undefined;
}

interface MissionTermsProps extends MissionLinks {
  detail: Pick<MissionDetailAsServed, 'mission' | 'group' | 'chain'> &
    Partial<Pick<MissionDetailAsServed, 'players'>>;
}

/**
 * The terms of a mission, as `mission` applies them: who issued it and who sees it, where, what
 * it takes, how long, how it ends, its escrow, and the missions to finish before it.
 */
export function MissionTerms({
  detail: { mission: m, group, chain, players },
  onOpenMission,
  onOpenPlayer,
  onOpenCorporation,
  onOpenPoliticalEntity,
}: MissionTermsProps) {
  const { t, i18n } = useTranslation();
  const none = <span className="text-fg-3">{t('missions.detail.none')}</span>;
  const holderLinks = {
    player: onOpenPlayer,
    corporation: onOpenCorporation,
    politics: onOpenPoliticalEntity,
  } as const;
  /** A player, corporation or political entity of `social`: its name, a link when it has a page. */
  const holder = (type: keyof typeof holderLinks, id: string) => (
    <HolderLink type={type} id={id} players={players} onOpen={holderLinks[type]} />
  );
  const issuerType =
    m.issuerType === 'player' || m.issuerType === 'corporation' || m.issuerType === 'politics'
      ? m.issuerType
      : undefined;

  const facts: [string, ReactNode][] = [
    [
      t('missions.detail.issuer'),
      <span key="issuer" className="flex flex-wrap items-center gap-2">
        {t(`missions.issuers.${m.issuerType}`)}
        {m.issuerId &&
          (issuerType ? holder(issuerType, m.issuerId) : <EntityLink id={m.issuerId} />)}
      </span>,
    ],
    [t('missions.detail.visibility'), t(`missions.visibility.${m.visibility}`)],
  ];
  if (m.groupId) {
    facts.push([
      t('missions.detail.group'),
      <span key="group" className="flex flex-wrap items-center gap-2">
        <EntityLink id={m.groupId} label={group?.name} />
        {m.groupClaimable && (
          <span className="text-xs text-fg-3">{t('missions.detail.claimable')}</span>
        )}
      </span>,
    ]);
  }
  facts.push(
    [
      t('missions.detail.zones'),
      m.zones.length === 0 ? (
        t('missions.detail.everywhere')
      ) : (
        <ul key="zones" className="flex flex-col gap-1">
          {m.zones.map((zone) =>
            zone.kind === 'system' ? (
              <li key={`system:${zone.system}`}>
                {t('missions.detail.system', { system: zone.system })}
              </li>
            ) : (
              <li key={`poi:${zone.poiId}`} className="flex items-center gap-2">
                {t('missions.detail.poi')}
                <IdLabel id={zone.poiId} />
              </li>
            ),
          )}
        </ul>
      ),
    ],
    [
      t('missions.detail.prerequisites'),
      m.prerequisites.length === 0 ? (
        none
      ) : (
        <ul key="prerequisites" className="flex flex-col gap-1">
          {m.prerequisites.map((p, i) => (
            <li key={`${p.kind}:${i}`} className="flex flex-wrap items-center gap-2">
              {t(`missions.prerequisiteKinds.${p.kind}` as never, { defaultValue: p.kind })}
              {p.params && <MonoText tone="subtle">{JSON.stringify(p.params)}</MonoText>}
            </li>
          ))}
        </ul>
      ),
    ],
    [
      t('missions.detail.expires'),
      m.expiresAt ? formatDateTime(m.expiresAt, i18n.language) : t('missions.detail.never'),
    ],
    [
      t('missions.detail.deadline'),
      m.assignmentDeadlineHours === null
        ? t('missions.detail.noDeadline')
        : t('missions.detail.deadlineHours', { count: m.assignmentDeadlineHours }),
    ],
    [
      t('missions.detail.completion'),
      t(m.autoComplete ? 'missions.detail.autoComplete' : 'missions.detail.manualComplete'),
    ],
    [
      t('missions.detail.partial'),
      t(m.allowPartial ? 'missions.detail.partialAllowed' : 'missions.detail.partialRefused'),
    ],
  );
  if (m.escrowStatus !== 'none' || m.escrowItemStatus !== 'none') {
    facts.push([
      t('missions.detail.escrow'),
      <span key="escrow" className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{t(`missions.escrowStatus.${m.escrowStatus}`)}</Badge>
        {m.escrowAmount !== null && m.escrowPayerId && (
          <span className="flex flex-wrap items-center gap-2">
            {t('missions.detail.escrowPaidBy', {
              amount: formatAmount(m.escrowAmount, m.escrowCurrency ?? 'credits', i18n.language),
              payer: t(`missions.issuers.${m.escrowPayerType}`),
            })}
            {holder(m.escrowPayerType, m.escrowPayerId)}
          </span>
        )}
        {m.escrowItemStatus !== 'none' && (
          <span className="text-xs text-fg-3">
            {t('missions.detail.itemEscrow', {
              status: t(`missions.escrowStatus.${m.escrowItemStatus}`),
            })}
          </span>
        )}
      </span>,
    ]);
  }
  if (chain.length > 0) {
    facts.push([
      t('missions.detail.chain'),
      <ul key="chain" className="flex flex-wrap gap-2">
        {chain.map((required) => (
          <li key={required.id}>
            {required.status === 'unknown' ? (
              <span className="text-fg-3" title={required.id}>
                {t('missions.detail.chainGone')}
              </span>
            ) : (
              <Chip variant="link" title={required.id} onClick={() => onOpenMission(required.id)}>
                {required.title}
                <span className="text-fg-3">
                  ·{' '}
                  {t(`missions.status.${required.status}` as never, {
                    defaultValue: required.status,
                  })}
                </span>
              </Chip>
            )}
          </li>
        ))}
      </ul>,
    ]);
  }
  if (m.scriptId)
    facts.push([t('missions.detail.script'), <MonoText key="script">{m.scriptId}</MonoText>]);
  if (m.createdBy) {
    facts.push([t('missions.detail.createdBy'), <MonoText key="by">{m.createdBy}</MonoText>]);
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{t('missions.detail.terms')}</h2>
      <FactList facts={facts} />
    </section>
  );
}
