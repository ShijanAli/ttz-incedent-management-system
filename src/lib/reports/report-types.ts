/**
 * Reports response schema. The mock generator returns exactly this shape, so the real
 * endpoint (GET /reports/overview?project_id=&period=) can replace it without UI changes.
 */

export type ReportPeriod = '7d' | '30d' | '90d' | '12m';

export interface ReportFilters {
  /** null = all projects the viewer can see */
  project_id: number | null;
  period: ReportPeriod;
}

/**
 * Workflow statuses are configurable per project, so every status maps to one of these
 * fixed buckets. The backend owns the mapping; the UI only groups by bucket.
 */
export type StatusCategory = 'pending' | 'in_progress' | 'resolved' | 'closed';

/** A value for this period and the previous period of the same length, for trend arrows */
export interface ComparedValue {
  value: number;
  previous: number;
}

export interface ReportSummary {
  total_projects: number;
  active_projects: number;
  total_issues: ComparedValue;
  pending: ComparedValue;
  in_progress: ComparedValue;
  resolved: ComparedValue;
  closed: ComparedValue;
  overdue: ComparedValue;
  unassigned: number;
  /** resolved + closed as a % of total_issues */
  resolution_rate: ComparedValue;
  /** Share of resolved issues finished on or before the due date, % */
  on_time_rate: ComparedValue;
  /** Hours from creation to resolution */
  avg_resolution_hours: ComparedValue;
}

export interface StatusBreakdownItem {
  status_id: number;
  name: string;
  color: string;
  category: StatusCategory;
  count: number;
  /** % of total_issues */
  ratio: number;
}

export interface PriorityBreakdownItem {
  priority: 'critical' | 'high' | 'medium' | 'low';
  count: number;
  ratio: number;
  /** Open (not resolved/closed) issues at this priority */
  open: number;
}

export interface TrendPoint {
  /** ISO date, start of the bucket (day for 7d/30d, week for 90d, month for 12m) */
  date: string;
  created: number;
  resolved: number;
}

export type ProjectHealth = 'on_track' | 'at_risk' | 'off_track';

export interface ProjectReportRow {
  id: number;
  name: string;
  total: number;
  pending: number;
  in_progress: number;
  resolved: number;
  closed: number;
  overdue: number;
  /** (resolved + closed) / total, % */
  progress: number;
  health: ProjectHealth;
  member_count: number;
}

export interface MemberReportRow {
  user: { id: number; name: string; designation: string | null };
  assigned: number;
  pending: number;
  in_progress: number;
  resolved: number;
  closed: number;
  overdue: number;
  /** (resolved + closed) / assigned, % */
  resolution_rate: number;
  /** This member's share of all resolved+closed issues, % (sums to 100 across members) */
  share_of_resolved: number;
  /** This member's share of all open assigned issues, % (workload distribution) */
  share_of_open: number;
  on_time_rate: number;
  avg_resolution_hours: number;
  /** Issues reopened after being resolved, % of resolved */
  reopen_rate: number;
  /** Resolved per bucket over the period, for a sparkline */
  resolved_trend: number[];
}

export type OverdueBucket = '1-3d' | '4-7d' | '8-14d' | '15d+';

export interface OverdueAgingItem {
  bucket: OverdueBucket;
  count: number;
  /** Critical/high issues in this bucket */
  urgent: number;
}

export interface SlaSummary {
  /** Open issues already past their SLA target */
  breached: number;
  /** Open issues that will breach within 24h */
  at_risk: number;
  /** Closed issues that met SLA, % */
  met_rate: ComparedValue;
}

export type Severity = 'blocker' | 'major' | 'minor' | 'trivial';

export interface SeverityBreakdownItem {
  severity: Severity;
  total: number;
  open: number;
  ratio: number;
}

export interface CustomerReportRow {
  id: number;
  name: string;
  total: number;
  open: number;
  resolved: number;
  overdue: number;
  /** Share of all issues raised by this customer, % */
  ratio: number;
}

/** One cell of the member x project heatmap */
export interface WorkloadCell {
  user_id: number;
  project_id: number;
  open: number;
}

export interface WorkloadMatrix {
  projects: { id: number; name: string }[];
  /** `capacity` is the open-issue limit before a member counts as overloaded */
  members: { user_id: number; name: string; open: number; capacity: number; utilization: number }[];
  cells: WorkloadCell[];
}

export interface ReportsOverview {
  generated_at: string;
  filters: ReportFilters;
  summary: ReportSummary;
  status_breakdown: StatusBreakdownItem[];
  priority_breakdown: PriorityBreakdownItem[];
  trend: TrendPoint[];
  projects: ProjectReportRow[];
  members: MemberReportRow[];
  overdue_aging: OverdueAgingItem[];
  sla: SlaSummary;
  severity_breakdown: SeverityBreakdownItem[];
  customers: CustomerReportRow[];
  workload: WorkloadMatrix;
}

/** GET /reports/members/{id}?project_id=&period= */
export interface MemberIssueRow {
  key: string;
  title: string;
  project: string;
  status: string;
  category: StatusCategory;
  priority: PriorityBreakdownItem['priority'];
  due_date: string;
  /** Days past due; 0 when not overdue */
  days_overdue: number;
}

export interface MemberReportDetail {
  member: MemberReportRow;
  by_project: { project_id: number; name: string; assigned: number; done: number }[];
  trend: TrendPoint[];
  issues: MemberIssueRow[];
}

/** GET/PUT /reports/schedule */
export type ScheduleSection = 'summary' | 'team' | 'projects' | 'overdue';

export interface ReportSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  /** 0 = Sunday ... 6 = Saturday; used when frequency is weekly */
  weekday: number;
  /** "HH:mm" in the viewer's timezone */
  time: string;
  recipients: string[];
  sections: ScheduleSection[];
}
