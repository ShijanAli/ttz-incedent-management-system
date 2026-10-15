import { formatDate } from '@/lib/shared-utils';
import type { ActivityEntry } from '@/redux/features/activity/activity-types';

export type ActivityTone = 'create' | 'update' | 'delete' | 'member' | 'group' | 'workflow' | 'neutral';

export interface ActivityChangeLine {
  field: string;
  from: string;
  to: string;
}

export interface WorkflowChange {
  /** Status names in their new order */
  order: string[];
  added: string[];
  removed: string[];
  reordered: boolean;
  initial: string | null;
  terminal: string[];
}

export interface ActivityDescription {
  /** Sentence after the actor's name, e.g. "changed the priority" */
  action: string;
  tone: ActivityTone;
  changes: ActivityChangeLine[];
  workflow?: WorkflowChange;
}

/** Friendlier names for fields that appear in change logs */
const FIELD_LABELS: Record<string, string> = {
  state: 'Status',
  status: 'Status',
  due_date: 'Due date',
  start_date: 'Start date',
  issue_type: 'Type',
  issue_category_id: 'Category',
  is_active: 'Active',
};

const MAX_VALUE_LENGTH = 80;

const humanize = (value: string) =>
  value.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();

export const fieldLabel = (field: string) => FIELD_LABELS[field] ?? humanize(field);

/** Renders any logged value as short, readable text */
export function formatActivityValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map((v) => formatActivityValue(field, v)).join(', ') : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  const text = String(value);
  if (field.endsWith('_date') || field.endsWith('_at')) return formatDate(text);
  // Enum-like values ("on_hold", "sev1") read better title-cased
  if (/^[a-z0-9_-]+$/.test(text) && ['state', 'status', 'priority', 'severity', 'issue_type', 'type'].includes(field)) {
    return humanize(text);
  }
  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text;
}

function diffLines(entry: ActivityEntry): ActivityChangeLine[] {
  const after = entry.changes?.attributes ?? {};
  const before = entry.changes?.old ?? {};
  return Object.keys(after).map((field) => ({
    field: fieldLabel(field),
    from: formatActivityValue(field, before[field]),
    to: formatActivityValue(field, after[field]),
  }));
}

interface LoggedStatus {
  name: string;
  slug: string;
  sort_order: number;
  is_initial: boolean;
  is_terminal: boolean;
}

const asStatuses = (value: unknown): LoggedStatus[] =>
  Array.isArray(value) ? [...(value as LoggedStatus[])].sort((a, b) => a.sort_order - b.sort_order) : [];

function describeWorkflow(entry: ActivityEntry): WorkflowChange {
  const before = asStatuses(entry.properties?.before);
  const after = asStatuses(entry.properties?.after);
  const beforeSlugs = before.map((s) => s.slug);
  const afterSlugs = after.map((s) => s.slug);
  const kept = afterSlugs.filter((slug) => beforeSlugs.includes(slug));
  const keptBefore = beforeSlugs.filter((slug) => afterSlugs.includes(slug));
  return {
    order: after.map((s) => s.name),
    added: after.filter((s) => !beforeSlugs.includes(s.slug)).map((s) => s.name),
    removed: before.filter((s) => !afterSlugs.includes(s.slug)).map((s) => s.name),
    reordered: kept.join() !== keptBefore.join(),
    initial: after.find((s) => s.is_initial)?.name ?? null,
    terminal: after.filter((s) => s.is_terminal).map((s) => s.name),
  };
}

/** "the project" for the page's own project, otherwise e.g. "issue ISS-1018 Test Issue" */
function subjectPhrase(entry: ActivityEntry, contextType: string): string {
  const subject = entry.subject;
  if (!subject) return 'an item';
  if (subject.type === contextType) return `the ${subject.type.toLowerCase()}`;
  return `${subject.type.toLowerCase()} ${subject.label}`;
}

/**
 * Turns a raw log entry into a sentence plus details.
 * @param resolveUserName maps user ids in `properties` to names (falls back to "User #id")
 * @param contextType the page's own subject type, so its entries read "the project"
 */
export function describeActivity(
  entry: ActivityEntry,
  resolveUserName: (id: number) => string | undefined,
  contextType = 'Project',
): ActivityDescription {
  const props = entry.properties ?? {};
  const userName = () => {
    const id = Number(props.user_id);
    return resolveUserName(id) ?? `User #${id}`;
  };
  const viaGroup = props.group_id ? ' via a group' : '';

  switch (entry.event) {
    case 'created':
      return { action: `created ${subjectPhrase(entry, contextType)}`, tone: 'create', changes: [] };
    case 'updated': {
      const changes = diffLines(entry);
      const what = changes.length === 1 ? `the ${changes[0].field.toLowerCase()} of` : '';
      return {
        action: `updated ${what} ${subjectPhrase(entry, contextType)}`.replace(/\s+/g, ' '),
        tone: 'update',
        changes,
      };
    }
    case 'deleted':
      return { action: `deleted ${subjectPhrase(entry, contextType)}`, tone: 'delete', changes: [] };
    case 'member.added':
      return {
        action: `added ${userName()}${props.role ? ` as ${props.role}` : ''}${viaGroup}`,
        tone: 'member',
        changes: [],
      };
    case 'member.removed':
      return { action: `removed ${userName()}${viaGroup}`, tone: 'delete', changes: [] };
    case 'member.role_changed':
      return { action: `changed ${userName()}'s role${props.role ? ` to ${props.role}` : ''}`, tone: 'member', changes: [] };
    case 'group.attached':
      return { action: `attached group ${props.group_name ?? `#${props.group_id}`}`, tone: 'group', changes: [] };
    case 'group.detached':
      return { action: `detached group ${props.group_name ?? `#${props.group_id}`}`, tone: 'delete', changes: [] };
    case 'project.statuses_changed': {
      const workflow = describeWorkflow(entry);
      const isSetup = asStatuses(props.before).length === 0;
      return { action: isSetup ? 'set up the workflow' : 'updated the workflow', tone: 'workflow', changes: [], workflow };
    }
    default:
      // Unknown events still read sensibly, e.g. "issue.assigned" -> "issue assigned"
      return { action: `${entry.event.replace(/[._]+/g, ' ')} ${subjectPhrase(entry, contextType)}`, tone: 'neutral', changes: diffLines(entry) };
  }
}

/** "Today", "Yesterday" or a date, for grouping a feed by day */
export function activityDayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return formatDate(iso);
}
