import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  cleanPlaceName,
  ErrorCode,
  placeNameProblem,
  PLACE_NAME_MAX_LENGTH,
  REFUSAL_REASON_MAX_LENGTH,
  type DiscoveryRow,
} from '@dyingstar-admin/schemas';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useApproveDiscovery, useRefuseDiscovery } from '@/hooks/useDiscoveries';
import { ApiError } from '@/lib/api';
import { planetLabel, type PlaceNameDecision } from '@/lib/discoveries';

/** The form of either decision: a name under the game's rule, or a reason (ADR 0032). */
const decisionFormSchema = (decision: PlaceNameDecision) =>
  z.object({
    name:
      decision === 'approve'
        ? z.string().superRefine((value, ctx) => {
            const problem = placeNameProblem(value);
            if (problem) ctx.addIssue({ code: 'custom', message: problem });
          })
        : z.string(),
    reason:
      decision === 'refuse' ? z.string().trim().min(1).max(REFUSAL_REASON_MAX_LENGTH) : z.string(),
  });
type DecisionForm = z.infer<ReturnType<typeof decisionFormSchema>>;

interface PlaceNameDecisionDialogProps {
  discovery: DiscoveryRow;
  decision: PlaceNameDecision;
  onClose: () => void;
}

/**
 * Approves a proposed place name, corrected if needed, or refuses it with a reason: the form,
 * then a summary to confirm (ADR 0032). The decision is saved on the discovery; the toast says
 * whether the discoverer was told. A discovery changed meanwhile closes the dialog, the list
 * being read again.
 */
export function PlaceNameDecisionDialog({
  discovery,
  decision,
  onClose,
}: PlaceNameDecisionDialogProps) {
  const { t } = useTranslation();
  const approve = useApproveDiscovery();
  const refuse = useRefuseDiscovery();
  const pending = approve.isPending || refuse.isPending;
  const d = discovery.object_data;
  const form = useForm<DecisionForm>({
    resolver: zodResolver(decisionFormSchema(decision)),
    defaultValues: { name: d.proposed_name, reason: '' },
    mode: 'onChange',
  });
  const [name = '', reason = ''] = useWatch({ control: form.control, name: ['name', 'reason'] });
  const [confirming, setConfirming] = useState(false);
  const discoverer = d.discoverer_name || d.discoverer_id.slice(0, 8) || '—';
  const kind = t(`exploration.names.kinds.${d.place_kind}` as never, {
    defaultValue: d.place_kind,
  });
  const problem = form.formState.errors.name?.message;

  /** What the toast adds: whether the discoverer was told, and their POI renamed. */
  const told = (result: { notified: boolean; recorded: boolean; poiRenamed?: boolean }) =>
    [
      t(
        result.notified
          ? 'exploration.decision.notified'
          : result.recorded
            ? 'exploration.decision.recordedOnly'
            : 'exploration.decision.notTold',
        { discoverer },
      ),
      result.poiRenamed === false && d.poi_id ? t('exploration.decision.poiKept') : null,
    ]
      .filter(Boolean)
      .join(' ');

  const submit = form.handleSubmit(async (values) => {
    try {
      if (decision === 'approve') {
        const approved = cleanPlaceName(values.name);
        const result = await approve.mutateAsync({
          uuid: discovery.uuid,
          base: d,
          name: approved,
        });
        toast.success(t('exploration.decision.approved', { name: approved }), {
          description: told(result),
        });
      } else {
        const result = await refuse.mutateAsync({
          uuid: discovery.uuid,
          base: d,
          reason: values.reason,
        });
        toast.success(t('exploration.decision.refused', { name: d.proposed_name }), {
          description: told(result),
        });
      }
      onClose();
    } catch (error) {
      // Someone (the game, another admin) changed it: the list, read again, shows where it is.
      if (error instanceof ApiError && error.code === ErrorCode.editConflict) {
        toast.error(t('exploration.decision.conflict'));
        onClose();
        return;
      }
      if (error instanceof ApiError && error.code === ErrorCode.discoveryNotPending) {
        toast.error(t('exploration.decision.notPending'));
        onClose();
        return;
      }
      toast.error(error instanceof ApiError ? error.message : t('exploration.decision.failed'));
      setConfirming(false);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-120">
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t(`exploration.decision.${decision}Title`)}</DialogTitle>
            <DialogDescription>{t(`exploration.decision.${decision}Hint`)}</DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            {t('exploration.decision.proposal', {
              name: d.proposed_name,
              discoverer,
              kind,
              planet: planetLabel(d.planet_name),
            })}
          </p>
          {confirming ? (
            <p role="alert" className="rounded-lg border border-destructive/50 px-3 py-2 text-sm">
              {decision === 'approve'
                ? t('exploration.decision.confirmApprove', {
                    name: cleanPlaceName(name),
                    kind,
                    discoverer,
                  })
                : t('exploration.decision.confirmRefuse', {
                    name: d.proposed_name,
                    discoverer,
                    reason: reason.trim(),
                  })}
            </p>
          ) : decision === 'approve' ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="place-name">{t('exploration.decision.name')}</Label>
              <Input
                id="place-name"
                autoComplete="off"
                aria-invalid={problem ? true : undefined}
                {...form.register('name')}
              />
              <span className="flex justify-between gap-2 text-xs text-fg-3">
                <span role={problem ? 'alert' : undefined}>
                  {problem
                    ? t(`exploration.decision.problems.${problem}` as never)
                    : t('exploration.decision.nameHint')}
                </span>
                <span>
                  {[...cleanPlaceName(name)].length} / {PLACE_NAME_MAX_LENGTH}
                </span>
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="refusal-reason">{t('exploration.decision.reason')}</Label>
              <Textarea
                id="refusal-reason"
                maxLength={REFUSAL_REASON_MAX_LENGTH}
                {...form.register('reason')}
              />
              <span className="flex justify-between gap-2 text-xs text-fg-3">
                <span>{t('exploration.decision.reasonHint')}</span>
                <span>
                  {reason.length} / {REFUSAL_REASON_MAX_LENGTH}
                </span>
              </span>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={confirming ? () => setConfirming(false) : onClose}
            >
              {confirming ? t('moderation.actions.back') : t('confirm.cancel')}
            </Button>
            {confirming ? (
              <Button
                type="submit"
                className="border-destructive/40 bg-destructive/15 text-destructive shadow-none hover:bg-destructive/25"
                disabled={pending}
              >
                {t('moderation.actions.confirm')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={!form.formState.isValid}
                onClick={() => setConfirming(true)}
              >
                {t('moderation.actions.continue')}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
