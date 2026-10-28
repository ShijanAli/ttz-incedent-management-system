import { PROJECT_PRIORITY_META, PROJECT_STATUS_META, getAvatarColor } from '@/lib/shared-utils';
import { DEFAULT_ROLE_PERMISSIONS } from '@/lib/permissions';
import type {
  ApiProject,
  ProjectMember,
  ProjectPriority,
  ProjectState,
  ProjectStatus,
  ProjectStatusInput,
} from '@/redux/features/projects/projects-types';

/** Every status the API accepts, used by the list filter */
export const PROJECT_STATUS_FILTER_OPTIONS = ['active', 'completed', 'archived'] as const satisfies readonly ProjectState[];

/** Statuses offered in the form; "archived" is set through Archive/Restore instead */
export const PROJECT_STATE_OPTIONS = ['active', 'completed'] as const satisfies readonly ProjectState[];

export const PROJECT_PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'] as const satisfies readonly ProjectPriority[];

export const PROJECT_COLORS = ['#2563eb', '#dc2626', '#059669', '#7c3aed', '#d97706', '#0891b2', '#db2777', '#64748b'];

const NEUTRAL_BADGE = 'bg-slate-100 text-slate-600 border-slate-200';

const titleCase = (value: string) =>
  value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Badge for a project state. Falls back to a neutral badge for states the backend
 * adds later, and to "—" when the API leaves the state out entirely.
 */
export function getProjectStateMeta(state: string | null | undefined) {
  if (!state) return { label: '—', badgeClass: NEUTRAL_BADGE };
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

/**
 * Checks a backend permission name against what the signed-in user has in this project.
 * The list response has no `my_permissions`, so there it falls back to the role's defaults.
 */
export function projectCan(project: Pick<ApiProject, 'my_permissions' | 'my_role'> | undefined, permission: string): boolean {
  if (!project) return false;
  const permissions = project.my_permissions ?? DEFAULT_ROLE_PERMISSIONS[project.my_role] ?? [];
  return permissions.includes(permission);
}

/** Whether a member's role grants a backend permission (system roles only) */
export function memberRoleHas(member: ProjectMember, permission: string): boolean {
  return DEFAULT_ROLE_PERMISSIONS[member.role]?.includes(permission) ?? false;
}

export function sortStatuses<T extends Pick<ProjectStatus, 'sort_order'>>(statuses: T[]): T[] {
  return [...statuses].sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Builds the PUT /statuses body from an ordered list, renumbering sort_order and
 * making sure exactly one status is initial.
 */
export function toStatusInputs(
  statuses: (Pick<ProjectStatus, 'id' | 'is_initial' | 'is_terminal'> & { name?: string })[],
  options: { byName?: boolean } = {},
): ProjectStatusInput[] {
  const named = (name: string | undefined, wanted: string) => name?.trim().toLowerCase() === wanted;
  // When the user hasn't picked flags themselves, follow the names: only "New" starts, only "Closed" ends
  const nameInitial = options.byName ? statuses.findIndex((s) => named(s.name, 'new')) : -1;
  const initialIndex = nameInitial >= 0 ? nameInitial : Math.max(0, statuses.findIndex((s) => s.is_initial));
  return statuses.map((s, index) => ({
    status_id: s.id,
    sort_order: index + 1,
    is_initial: index === initialIndex,
    // The API rejects a workflow where "Closed" isn't final or "Reassign" is; ids can't be trusted after renames
    is_terminal: options.byName
      ? named(s.name, 'closed')
      : named(s.name, 'closed') || (!named(s.name, 'reassign') && s.is_terminal),
  }));
}
