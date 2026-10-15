import { PROJECT_PRIORITY_META, PROJECT_STATUS_META, getAvatarColor } from '@/lib/shared-utils';
import { DEFAULT_ROLE_PERMISSIONS } from '@/lib/permissions';
import type {
  ApiProject,
  ProjectMember,
  ProjectStatus,
  ProjectStatusInput,
} from '@/redux/features/projects/projects-types';

/** States offered in filters and forms; "archived" is reached through Archive/Restore */
export const PROJECT_STATE_OPTIONS = ['planning', 'active', 'on_hold', 'completed'] as const;

export const PROJECT_COLORS = ['#2563eb', '#dc2626', '#059669', '#7c3aed', '#d97706', '#0891b2', '#db2777', '#64748b'];

const NEUTRAL_BADGE = 'bg-slate-100 text-slate-600 border-slate-200';

const titleCase = (value: string) =>
  value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Falls back to a neutral badge for states the backend adds later */
export function getProjectStateMeta(state: string) {
  return (
    (PROJECT_STATUS_META as Record<string, { label: string; badgeClass: string }>)[state] ?? {
      label: titleCase(state),
      badgeClass: NEUTRAL_BADGE,
    }
  );
}

/** null until the backend returns priority */
export function getProjectPriorityMeta(priority: string | null | undefined) {
  if (!priority) return null;
  return (PROJECT_PRIORITY_META as Record<string, { label: string; badgeClass: string }>)[priority] ?? null;
}

/** Initials for the project's avatar tile, e.g. "Trakon Mobile App" → "TMA" */
export function getProjectInitials(project: Pick<ApiProject, 'name'>): string {
  const words = project.name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join('').toUpperCase();
}

/** Stable per-project color until the backend stores one */
export function getProjectColor(project: Pick<ApiProject, 'id' | 'color'>): string {
  return project.color || getAvatarColor(project.id);
}

/** Share of issues that are closed, 0-100 */
export function getProjectProgress(project: Pick<ApiProject, 'issue_counts'>): number {
  const { total, closed } = project.issue_counts;
  return total > 0 ? Math.round((closed / total) * 100) : 0;
}

/** Checks a backend permission name against what the signed-in user has in this project */
export function projectCan(project: Pick<ApiProject, 'my_permissions'> | undefined, permission: string): boolean {
  return project?.my_permissions.includes(permission) ?? false;
}

/** Whether a member's role grants a backend permission (system roles only) */
export function memberRoleHas(member: ProjectMember, permission: string): boolean {
  return DEFAULT_ROLE_PERMISSIONS[member.role]?.includes(permission) ?? false;
}

export function sortStatuses<T extends Pick<ProjectStatus, 'sort_order'>>(statuses: T[]): T[] {
  return [...statuses].sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Every status seen across the given projects, de-duplicated by id. There is no
 * global status API yet, so this is the pool new projects can choose from.
 */
export function collectStatusCatalog(projects: Pick<ApiProject, 'statuses'>[]): ProjectStatus[] {
  const byId = new Map<number, ProjectStatus>();
  for (const project of projects) {
    for (const status of project.statuses) {
      if (!byId.has(status.id)) byId.set(status.id, { ...status, count: undefined });
    }
  }
  return sortStatuses([...byId.values()]);
}

/**
 * Builds the PUT /statuses body from an ordered list, renumbering sort_order and
 * making sure exactly one status is initial.
 */
export function toStatusInputs(
  statuses: Pick<ProjectStatus, 'id' | 'is_initial' | 'is_terminal'>[],
): ProjectStatusInput[] {
  const initialIndex = Math.max(0, statuses.findIndex((s) => s.is_initial));
  return statuses.map((s, index) => ({
    status_id: s.id,
    sort_order: index + 1,
    is_initial: index === initialIndex,
    is_terminal: s.is_terminal,
  }));
}
