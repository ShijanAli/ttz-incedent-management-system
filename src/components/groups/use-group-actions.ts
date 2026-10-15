import { useState } from 'react';
import { toast } from 'sonner';
import { parseApiError } from '@/lib/api-error';
import { useDeleteGroupMutation, useUpdateGroupMutation } from '@/redux/features/groups/groups-api';
import type { ApiGroup } from '@/redux/features/groups/groups-types';

export type GroupActionType = 'activate' | 'deactivate' | 'delete';

type PendingAction = { group: ApiGroup; action: GroupActionType };

/** Confirm-dialog copy for every group action */
const GROUP_ACTION_CONFIG: Record<GroupActionType, {
  title: string;
  confirmLabel: string;
  variant: 'default' | 'destructive';
  describe: (group: ApiGroup) => string;
  success: string;
}> = {
  activate: {
    title: 'Activate group',
    confirmLabel: 'Activate',
    variant: 'default',
    describe: (g) => `Activate "${g.name}"? It can then be attached to projects again.`,
    success: 'Group activated',
  },
  deactivate: {
    title: 'Deactivate group',
    confirmLabel: 'Deactivate',
    variant: 'destructive',
    describe: (g) => `Deactivate "${g.name}"? It can no longer be attached to projects.`,
    success: 'Group deactivated',
  },
  delete: {
    title: 'Delete group',
    confirmLabel: 'Delete',
    variant: 'destructive',
    describe: (g) =>
      `Permanently delete "${g.name}"? Members who only had access to projects through this group will lose it. This cannot be undone.`,
    success: 'Group deleted',
  },
};

/**
 * Activate / deactivate / delete with a confirmation step. Spread `dialogProps`
 * onto <ConfirmDialog /> and call `request(group, action)` from a button.
 */
export function useGroupActions(options?: { onDeleted?: (group: ApiGroup) => void }) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [updateGroup] = useUpdateGroupMutation();
  const [deleteGroup] = useDeleteGroupMutation();

  const run = async ({ group, action }: PendingAction) => {
    const config = GROUP_ACTION_CONFIG[action];
    try {
      if (action === 'delete') {
        await deleteGroup(group.id).unwrap();
        options?.onDeleted?.(group);
      } else {
        await updateGroup({ id: group.id, is_active: action === 'activate' }).unwrap();
      }
      toast.success(config.success, { description: group.name });
    } catch (err) {
      toast.error(`Failed to ${config.confirmLabel.toLowerCase()} group`, { description: parseApiError(err).message });
    }
  };

  const config = pending ? GROUP_ACTION_CONFIG[pending.action] : null;

  return {
    request: (group: ApiGroup, action: GroupActionType) => setPending({ group, action }),
    dialogProps: {
      open: Boolean(pending),
      onOpenChange: (open: boolean) => { if (!open) setPending(null); },
      title: config?.title ?? '',
      description: pending && config ? config.describe(pending.group) : '',
      confirmLabel: config?.confirmLabel,
      variant: config?.variant,
      onConfirm: async () => { if (pending) await run(pending); },
    },
  };
}
