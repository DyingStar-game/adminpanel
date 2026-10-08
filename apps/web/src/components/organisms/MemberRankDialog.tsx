import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { TwoStepDialog } from '@/components/molecules/TwoStepDialog';
import { Label } from '@/components/ui/label';
import { useSetMemberRank } from '@/hooks/useOrganisationActions';
import { ApiError } from '@/lib/api';
import type { OrganisationRole } from '@/lib/organisations';

const RankFormSchema = z.object({ rankId: z.string().regex(/^\d+$/) });
type RankForm = z.infer<typeof RankFormSchema>;

interface MemberRankDialogProps {
  corporationId: string;
  member: { playerId: string; displayName: string; role: string };
  /** The ranks that may be given: every one but the CEO's (that one goes by transfer). */
  ranks: OrganisationRole[];
  onClose: () => void;
}

/** Changes a corporation member's rank (step N), `social` acting as the CEO. */
export function MemberRankDialog({ corporationId, member, ranks, onClose }: MemberRankDialogProps) {
  const { t } = useTranslation();
  const setRank = useSetMemberRank(corporationId);
  const form = useForm<RankForm>({
    resolver: zodResolver(RankFormSchema),
    defaultValues: { rankId: '' },
    mode: 'onChange',
  });
  const rankId = useWatch({ control: form.control, name: 'rankId' });
  const [confirming, setConfirming] = useState(false);
  const rank = ranks.find((r) => String(r.id) === rankId)?.name ?? '';

  const submit = form.handleSubmit(async (values) => {
    try {
      await setRank.mutateAsync({ playerId: member.playerId, rankId: Number(values.rankId) });
      toast.success(t('organisations.manage.ranked', { name: member.displayName, rank }));
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('moderation.unavailable'));
      setConfirming(false);
    }
  });

  return (
    <TwoStepDialog
      title={t('organisations.manage.rankTitle', { name: member.displayName })}
      description={t('organisations.manage.rankHint', { rank: member.role })}
      confirming={confirming}
      summary={t('organisations.manage.rankSummary', {
        name: member.displayName,
        from: member.role,
        to: rank,
      })}
      canContinue={form.formState.isValid}
      pending={setRank.isPending}
      onContinue={() => setConfirming(true)}
      onBack={() => setConfirming(false)}
      onCancel={onClose}
      onSubmit={(event) => void submit(event)}
      labels={{
        cancel: t('confirm.cancel'),
        back: t('moderation.actions.back'),
        continue: t('moderation.actions.continue'),
        confirm: t('moderation.actions.confirm'),
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label>{t('organisations.columns.rank')}</Label>
        <Controller
          control={form.control}
          name="rankId"
          render={({ field }) => (
            <OptionSelect<string>
              label={t('organisations.columns.rank')}
              value={field.value}
              options={ranks.map((r) => ({ value: String(r.id), label: r.name }))}
              onChange={field.onChange}
              className="w-48"
            />
          )}
        />
      </div>
    </TwoStepDialog>
  );
}
