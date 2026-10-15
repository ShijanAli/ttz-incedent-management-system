import type { ApiProject } from '@/redux/features/projects/projects-types';

export const ARCHIVED_STATE = 'archived';

export type ProjectActionType = 'archive' | 'restore' | 'delete';

/** Confirm-dialog copy for every project action, shared by the list and detail pages */
export const PROJECT_ACTION_CONFIG: Record<ProjectActionType, {
  title: string;
  confirmLabel: string;
  variant: 'default' | 'destructive';
  describe: (project: ApiProject) => string;
  success: string;
}> = {
  archive: {
    title: 'Archive project',
    confirmLabel: 'Archive',
    variant: 'destructive',
    describe: (p) => `Are you sure you want to archive "${p.name}"? You can restore it later from the archived view.`,
    success: 'Project archived',
  },
  restore: {
    title: 'Restore project',
    confirmLabel: 'Restore',
    variant: 'default',
    describe: (p) => `Restore "${p.name}" to active status?`,
    success: 'Project restored',
  },
  delete: {
    title: 'Delete project',
    confirmLabel: 'Delete',
    variant: 'destructive',
    describe: (p) => `Permanently delete "${p.name}"? Its issues, members and workflow will be removed. This cannot be undone.`,
    success: 'Project deleted',
  },
};
