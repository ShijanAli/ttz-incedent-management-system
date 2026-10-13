import type {
  IssueStatus, IssuePriority, IssueType, IssueSeverity, ProjectStatus, ProjectPriority,
} from '@/lib/types';

export const ISSUE_SEVERITY_META: Record<IssueSeverity, { label: string; color: string; badgeClass: string }> = {
  sev1: { label: 'SEV1', color: '#dc2626', badgeClass: 'bg-red-50 text-red-700 border-red-200' },
  sev2: { label: 'SEV2', color: '#ea580c', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' },
  sev3: { label: 'SEV3', color: '#d97706', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  sev4: { label: 'SEV4', color: '#0891b2', badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
};

export const ISSUE_SEVERITY_OPTIONS: { value: IssueSeverity; label: string; description: string }[] = [
  { value: 'sev1', label: 'SEV1', description: 'Critical — system down or data loss' },
  { value: 'sev2', label: 'SEV2', description: 'High — major functionality broken' },
  { value: 'sev3', label: 'SEV3', description: 'Medium — workaround available' },
  { value: 'sev4', label: 'SEV4', description: 'Low — minor or cosmetic' },
];

export const ISSUE_TYPE_OPTIONS: { value: IssueType; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'incident', label: 'Incident' },
  { value: 'task', label: 'Task' },
  { value: 'improvement', label: 'Improvement' },
  { value: 'security', label: 'Security' },
];

export const ISSUE_STATUS_ORDER: IssueStatus[] = ['todo', 'in_progress', 'completed', 'approved', 'on_hold'];

export const ISSUE_STATUS_META: Record<IssueStatus, { label: string; color: string; badgeClass: string }> = {
  todo: { label: 'To Do', color: '#64748b', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' },
  in_progress: { label: 'In Progress', color: '#2563eb', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  completed: { label: 'Completed', color: '#059669', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  approved: { label: 'Approved', color: '#7c3aed', badgeClass: 'bg-violet-50 text-violet-700 border-violet-200' },
  on_hold: { label: 'On Hold', color: '#d97706', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export const ISSUE_PRIORITY_META: Record<IssuePriority, { label: string; color: string; badgeClass: string }> = {
  critical: { label: 'Critical', color: '#dc2626', badgeClass: 'bg-red-50 text-red-700 border-red-200' },
  high: { label: 'High', color: '#ea580c', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' },
  medium: { label: 'Medium', color: '#d97706', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  low: { label: 'Low', color: '#0891b2', badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
};

export const ISSUE_TYPE_META: Record<IssueType, { label: string; color: string; badgeClass: string }> = {
  bug: { label: 'Bug', color: '#dc2626', badgeClass: 'bg-red-50 text-red-700 border-red-200' },
  incident: { label: 'Incident', color: '#ea580c', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' },
  task: { label: 'Task', color: '#2563eb', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  improvement: { label: 'Improvement', color: '#059669', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  security: { label: 'Security', color: '#7c3aed', badgeClass: 'bg-violet-50 text-violet-700 border-violet-200' },
};

export const PROJECT_STATUS_META: Record<ProjectStatus, { label: string; badgeClass: string }> = {
  planning: { label: 'Planning', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200' },
  active: { label: 'Active', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  on_hold: { label: 'On Hold', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  completed: { label: 'Completed', badgeClass: 'bg-violet-50 text-violet-700 border-violet-200' },
  archived: { label: 'Archived', badgeClass: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export const PROJECT_PRIORITY_META: Record<ProjectPriority, { label: string; badgeClass: string }> = {
  low: { label: 'Low', badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  medium: { label: 'Medium', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  high: { label: 'High', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' },
  critical: { label: 'Critical', badgeClass: 'bg-red-50 text-red-700 border-red-200' },
};

export function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatRelativeTime(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return formatDate(iso);
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function isOverdue(dueDate?: string, status?: string): boolean {
  if (!dueDate) return false;
  if (status === 'completed' || status === 'approved') return false;
  return new Date(dueDate) < new Date();
}

export function calculateProjectProgress(projectId: string, issues: { projectId: string; status: string }[]): number {
  const projectIssues = issues.filter((i) => i.projectId === projectId);
  if (projectIssues.length === 0) return 0;
  const done = projectIssues.filter((i) => i.status === 'completed' || i.status === 'approved').length;
  return Math.round((done / projectIssues.length) * 100);
}

export const GROUP_TYPE_META: Record<string, { label: string; badgeClass: string; description: string }> = {
  default: {
    label: 'Default',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'All project members are automatically included',
  },
  private: {
    label: 'Private',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Visible to project members, content only for group members',
  },
  secret: {
    label: 'Secret',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    description: 'Invisible to anyone who is not a group member',
  },
};
