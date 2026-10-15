import { useState } from 'react';
import { toast } from 'sonner';
import { parseApiError } from '@/lib/api-error';
import { useDeleteProjectMutation, useUpdateProjectMutation } from '@/redux/features/projects/projects-api';
import type { ApiProject } from '@/redux/features/projects/projects-types';
import { ARCHIVED_STATE, PROJECT_ACTION_CONFIG, type ProjectActionType } from './project-actions';

type PendingAction = { project: ApiProject; action: ProjectActionType };

/**
 * Archive / restore / delete with a confirmation step. Spread `dialogProps`
 * onto <ConfirmDialog /> and call `request(project, action)` from a button.
 */
export function useProjectActions(options?: { onDeleted?: (project: ApiProject) => void }) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [updateProject] = useUpdateProjectMutation();
  const [deleteProject] = useDeleteProjectMutation();

  const run = async ({ project, action }: PendingAction) => {
    const config = PROJECT_ACTION_CONFIG[action];
    try {
      if (action === 'delete') {
        await deleteProject(project.id).unwrap();
        options?.onDeleted?.(project);
      } else {
        // The API has no archive endpoint; archiving is a status change
        await updateProject({ id: project.id, status: action === 'archive' ? ARCHIVED_STATE : 'active' }).unwrap();
      }
      toast.success(config.success, { description: project.name });
    } catch (err) {
      toast.error(`Failed to ${config.confirmLabel.toLowerCase()} project`, { description: parseApiError(err).message });
    }
  };

  const config = pending ? PROJECT_ACTION_CONFIG[pending.action] : null;

  return {
    request: (project: ApiProject, action: ProjectActionType) => setPending({ project, action }),
    dialogProps: {
      open: Boolean(pending),
      onOpenChange: (open: boolean) => { if (!open) setPending(null); },
      title: config?.title ?? '',
      description: pending && config ? config.describe(pending.project) : '',
      confirmLabel: config?.confirmLabel,
      variant: config?.variant,
      onConfirm: async () => { if (pending) await run(pending); },
    },
  };
}
