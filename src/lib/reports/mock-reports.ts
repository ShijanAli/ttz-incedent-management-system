import type {
  CustomerReportRow, MemberIssueRow, MemberReportDetail, MemberReportRow, OverdueAgingItem,
  PriorityBreakdownItem, ProjectHealth, ProjectReportRow, ReportFilters, ReportPeriod, ReportSchedule,
  ReportsOverview, Severity, SeverityBreakdownItem, StatusBreakdownItem, StatusCategory, TrendPoint,
  WorkloadMatrix,
} from './report-types';

/** Deterministic PRNG so the mock numbers don't jump around on every render */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MOCK_PROJECTS = [
  { id: 1, name: 'Customer Portal', size: 46, members: [1, 2, 3, 5, 7] },
  { id: 2, name: 'Mobile App', size: 38, members: [2, 4, 6, 8] },
  { id: 3, name: 'Billing Revamp', size: 30, members: [1, 3, 4, 8] },
  { id: 4, name: 'Internal Tools', size: 22, members: [5, 6, 7] },
  { id: 5, name: 'Data Platform', size: 28, members: [1, 2, 6, 7, 8] },
];

/** `skill` drives how fast / reliable a member is, so the report has a believable spread */
const MOCK_MEMBERS = [
  { id: 1, name: 'Rahim Uddin', designation: 'Senior Backend Developer', skill: 0.92, speed: 14, load: 1.15 },
  { id: 2, name: 'Nusrat Jahan', designation: 'Frontend Developer', skill: 0.86, speed: 18, load: 1.0 },
  { id: 3, name: 'Tanvir Hasan', designation: 'Full Stack Developer', skill: 0.74, speed: 26, load: 1.2 },
  { id: 4, name: 'Sadia Rahman', designation: 'QA Engineer', skill: 0.9, speed: 12, load: 0.9 },
  { id: 5, name: 'Imran Khan', designation: 'Backend Developer', skill: 0.62, speed: 38, load: 1.3 },
  { id: 6, name: 'Farhana Akter', designation: 'UI/UX Developer', skill: 0.81, speed: 20, load: 0.8 },
  { id: 7, name: 'Mahmud Hossain', designation: 'DevOps Engineer', skill: 0.7, speed: 30, load: 0.7 },
  { id: 8, name: 'Jannat Ara', designation: 'Junior Developer', skill: 0.55, speed: 44, load: 0.6 },
];

const MOCK_STATUSES: { id: number; name: string; color: string; category: StatusCategory }[] = [
  { id: 1, name: 'Open', color: '#f59e0b', category: 'pending' },
  { id: 2, name: 'To Do', color: '#fbbf24', category: 'pending' },
  { id: 3, name: 'In Progress', color: '#3b82f6', category: 'in_progress' },
  { id: 4, name: 'In Review', color: '#8b5cf6', category: 'in_progress' },
  { id: 5, name: 'Resolved', color: '#10b981', category: 'resolved' },
  { id: 6, name: 'Closed', color: '#64748b', category: 'closed' },
];

const MOCK_CUSTOMERS = [
  { id: 1, name: 'Acme Corporation', weight: 30, satisfaction: 0.85 },
  { id: 2, name: 'Globex Ltd', weight: 24, satisfaction: 0.7 },
  { id: 3, name: 'Initech', weight: 18, satisfaction: 0.9 },
  { id: 4, name: 'Umbrella Group', weight: 14, satisfaction: 0.6 },
  { id: 5, name: 'Stark Logistics', weight: 9, satisfaction: 0.8 },
  { id: 6, name: 'Internal / No customer', weight: 5, satisfaction: 0.95 },
];

const PERIOD_FACTOR: Record<ReportPeriod, number> = { '7d': 0.14, '30d': 0.4, '90d': 0.75, '12m': 1.4 };

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);
const compared = (value: number, rand: () => number) => ({ value, previous: Math.max(0, Math.round(value * (0.78 + rand() * 0.4))) });

interface Cell {
  projectId: number;
  userId: number;
  /** Counts per status id */
  byStatus: Record<number, number>;
  overdue: number;
}

function buildCells(period: ReportPeriod): Cell[] {
  const factor = PERIOD_FACTOR[period];
  const cells: Cell[] = [];
  for (const project of MOCK_PROJECTS) {
    for (const userId of project.members) {
      const member = MOCK_MEMBERS.find((m) => m.id === userId)!;
      const rand = mulberry32(project.id * 100 + userId);
      const assigned = Math.max(1, Math.round((project.size / project.members.length) * member.load * (0.7 + rand() * 0.6) * factor * 2));
      // Strong members close more of what they get
      const doneShare = Math.min(0.92, member.skill * (0.8 + rand() * 0.3));
      const done = Math.round(assigned * doneShare);
      const closed = Math.round(done * (0.3 + rand() * 0.2));
      const resolved = done - closed;
      const open = assigned - done;
      const doing = Math.round(open * (0.45 + rand() * 0.2));
      const review = Math.round(doing * 0.3);
      const todo = Math.round((open - doing) * 0.5);
      cells.push({
        projectId: project.id,
        userId,
        byStatus: { 1: open - doing - todo, 2: todo, 3: doing - review, 4: review, 5: resolved, 6: closed },
        overdue: Math.min(open, Math.round(open * (1 - member.skill) * (0.8 + rand()))),
      });
    }
  }
  return cells;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const cellTotal = (c: Cell) => sum(Object.values(c.byStatus));

/** Splits `total` over `n` buckets with a gentle upward drift and noise */
function spread(total: number, n: number, rand: () => number, drift = 0.5): number[] {
  const weights = Array.from({ length: n }, (_, i) => (1 + drift * (i / Math.max(n - 1, 1))) * (0.65 + rand() * 0.7));
  const wsum = sum(weights);
  return weights.map((w) => Math.round((w / wsum) * total));
}

function buildTrend(period: ReportPeriod, created: number, resolved: number): TrendPoint[] {
  const n = { '7d': 7, '30d': 30, '90d': 13, '12m': 12 }[period];
  const rand = mulberry32(n * 7919);
  const createdSeries = spread(created, n, rand, 0.2);
  const resolvedSeries = spread(resolved, n, rand, 0.6);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return createdSeries.map((c, i) => {
    const date = new Date(today);
    const back = n - 1 - i;
    if (period === '12m') date.setMonth(date.getMonth() - back, 1);
    else date.setDate(date.getDate() - back * (period === '90d' ? 7 : 1));
    return { date: date.toISOString(), created: c, resolved: resolvedSeries[i] };
  });
}

function projectHealth(progress: number, overdue: number, total: number): ProjectHealth {
  const overdueShare = total > 0 ? overdue / total : 0;
  if (overdueShare > 0.15 || progress < 40) return 'off_track';
  if (overdueShare > 0.07 || progress < 60) return 'at_risk';
  return 'on_track';
}

/** Mock of GET /reports/overview. Replace the body with the real request later. */
export function getMockReportsOverview(filters: ReportFilters): ReportsOverview {
  const rand = mulberry32(filters.project_id ?? 999);
  const cells = buildCells(filters.period).filter((c) => filters.project_id == null || c.projectId === filters.project_id);
  const projects = MOCK_PROJECTS.filter((p) => filters.project_id == null || p.id === filters.project_id);

  const countFor = (cs: Cell[], category: StatusCategory) =>
    sum(cs.map((c) => sum(MOCK_STATUSES.filter((s) => s.category === category).map((s) => c.byStatus[s.id]))));

  // ---- Statuses & priorities ----
  const total = sum(cells.map(cellTotal));
  const unassigned = Math.round(total * 0.06);
  const grandTotal = total + unassigned;
  const status_breakdown: StatusBreakdownItem[] = MOCK_STATUSES.map((s) => {
    const count = sum(cells.map((c) => c.byStatus[s.id])) + (s.id === 1 ? unassigned : 0);
    return { status_id: s.id, name: s.name, color: s.color, category: s.category, count, ratio: pct(count, grandTotal) };
  });

  const openTotal = countFor(cells, 'pending') + countFor(cells, 'in_progress') + unassigned;
  const priorityShare = { critical: 0.08, high: 0.24, medium: 0.46, low: 0.22 } as const;
  const priority_breakdown: PriorityBreakdownItem[] = (Object.keys(priorityShare) as (keyof typeof priorityShare)[]).map((p) => ({
    priority: p,
    count: Math.round(grandTotal * priorityShare[p]),
    ratio: Math.round(priorityShare[p] * 1000) / 10,
    open: Math.round(openTotal * priorityShare[p] * (p === 'critical' ? 0.7 : 1)),
  }));

  // ---- Members ----
  const memberIds = [...new Set(cells.map((c) => c.userId))];
  const totalDone = sum(cells.map((c) => c.byStatus[5] + c.byStatus[6]));
  const totalOpenAssigned = sum(cells.map((c) => c.byStatus[1] + c.byStatus[2] + c.byStatus[3] + c.byStatus[4]));
  const members: MemberReportRow[] = memberIds.map((id) => {
    const profile = MOCK_MEMBERS.find((m) => m.id === id)!;
    const mine = cells.filter((c) => c.userId === id);
    const assigned = sum(mine.map(cellTotal));
    const pending = sum(mine.map((c) => c.byStatus[1] + c.byStatus[2]));
    const in_progress = sum(mine.map((c) => c.byStatus[3] + c.byStatus[4]));
    const resolved = sum(mine.map((c) => c.byStatus[5]));
    const closed = sum(mine.map((c) => c.byStatus[6]));
    const done = resolved + closed;
    const r = mulberry32(id * 31);
    return {
      user: { id, name: profile.name, designation: profile.designation },
      assigned, pending, in_progress, resolved, closed,
      overdue: sum(mine.map((c) => c.overdue)),
      resolution_rate: pct(done, assigned),
      share_of_resolved: pct(done, totalDone),
      share_of_open: pct(pending + in_progress, totalOpenAssigned),
      on_time_rate: Math.round(Math.min(98, profile.skill * 100 + 4 + r() * 6) * 10) / 10,
      avg_resolution_hours: Math.round(profile.speed * (0.9 + r() * 0.3)),
      reopen_rate: Math.round((1 - profile.skill) * 22 * (0.7 + r() * 0.6) * 10) / 10,
      resolved_trend: spread(done, 8, r, 0.8),
    };
  }).sort((a, b) => b.resolved + b.closed - (a.resolved + a.closed));

  // ---- Projects ----
  const projectRows: ProjectReportRow[] = projects.map((p) => {
    const cs = cells.filter((c) => c.projectId === p.id);
    const t = sum(cs.map(cellTotal));
    const resolved = countFor(cs, 'resolved');
    const closed = countFor(cs, 'closed');
    const overdue = sum(cs.map((c) => c.overdue));
    const progress = Math.round(pct(resolved + closed, t));
    return {
      id: p.id, name: p.name, total: t,
      pending: countFor(cs, 'pending'), in_progress: countFor(cs, 'in_progress'),
      resolved, closed, overdue, progress,
      health: projectHealth(progress, overdue, t),
      member_count: p.members.length,
    };
  }).sort((a, b) => b.total - a.total);

  // ---- Summary ----
  const resolved = countFor(cells, 'resolved');
  const closed = countFor(cells, 'closed');
  const overdue = sum(cells.map((c) => c.overdue));
  const wAvg = (pick: (m: MemberReportRow) => number) =>
    members.length ? Math.round((sum(members.map((m) => pick(m) * m.assigned)) / sum(members.map((m) => m.assigned))) * 10) / 10 : 0;

  // ---- Overdue aging & SLA ----
  const agingShare: [OverdueAgingItem['bucket'], number][] = [['1-3d', 0.38], ['4-7d', 0.3], ['8-14d', 0.2], ['15d+', 0.12]];
  const overdue_aging: OverdueAgingItem[] = agingShare.map(([bucket, share]) => {
    const count = Math.round(overdue * share);
    return { bucket, count, urgent: Math.round(count * (bucket === '1-3d' ? 0.2 : 0.35)) };
  });
  const slaMet = Math.min(99, wAvg((m) => m.on_time_rate) - 3);

  // ---- Severity ----
  const openRatio = grandTotal ? openTotal / grandTotal : 0;
  const severityShare: Record<Severity, number> = { blocker: 0.06, major: 0.27, minor: 0.45, trivial: 0.22 };
  const severity_breakdown: SeverityBreakdownItem[] = (Object.keys(severityShare) as Severity[]).map((severity) => {
    const sev = Math.round(grandTotal * severityShare[severity]);
    return {
      severity, total: sev, ratio: Math.round(severityShare[severity] * 1000) / 10,
      open: Math.round(sev * openRatio * (severity === 'blocker' ? 0.75 : severity === 'trivial' ? 1.2 : 1)),
    };
  });

  // ---- Customers ----
  const customerWeights = MOCK_CUSTOMERS.map((c, i) => c.weight * (0.85 + mulberry32(i + (filters.project_id ?? 0) * 13)() * 0.3));
  const weightSum = sum(customerWeights);
  const customers: CustomerReportRow[] = MOCK_CUSTOMERS.map((c, i) => {
    const t = Math.round((grandTotal * customerWeights[i]) / weightSum);
    const open = Math.round(t * openRatio * (1.3 - c.satisfaction));
    return {
      id: c.id, name: c.name, total: t, open: Math.min(open, t),
      resolved: Math.max(0, t - open), overdue: Math.round(Math.min(open, t) * (1 - c.satisfaction) * 0.6),
      ratio: pct(t, grandTotal),
    };
  }).sort((a, b) => b.total - a.total);

  // ---- Workload heatmap ----
  const factor = PERIOD_FACTOR[filters.period];
  const openOf = (c: Cell) => c.byStatus[1] + c.byStatus[2] + c.byStatus[3] + c.byStatus[4];
  const workload: WorkloadMatrix = {
    projects: projects.map(({ id, name }) => ({ id, name })),
    members: members.map((m) => {
      const profile = MOCK_MEMBERS.find((p) => p.id === m.user.id)!;
      const capacity = Math.max(3, Math.round(12 * (factor / 0.4) * (0.85 + profile.skill * 0.3)));
      const open = m.pending + m.in_progress;
      return { user_id: m.user.id, name: m.user.name, open, capacity, utilization: Math.round((open / capacity) * 100) };
    }),
    cells: cells.map((c) => ({ user_id: c.userId, project_id: c.projectId, open: openOf(c) })),
  };

  return {
    generated_at: new Date().toISOString(),
    filters,
    overdue_aging,
    sla: {
      breached: Math.round(overdue * 0.7),
      at_risk: Math.round(openTotal * 0.06),
      met_rate: { value: Math.round(slaMet * 10) / 10, previous: Math.round(slaMet * (0.9 + rand() * 0.14) * 10) / 10 },
    },
    severity_breakdown,
    customers,
    workload,
    summary: {
      total_projects: projects.length,
      active_projects: projects.length - (filters.project_id == null ? 1 : 0),
      total_issues: compared(grandTotal, rand),
      pending: compared(countFor(cells, 'pending') + unassigned, rand),
      in_progress: compared(countFor(cells, 'in_progress'), rand),
      resolved: compared(resolved, rand),
      closed: compared(closed, rand),
      overdue: compared(overdue, rand),
      unassigned,
      resolution_rate: { value: pct(resolved + closed, grandTotal), previous: Math.round(pct(resolved + closed, grandTotal) * (0.88 + rand() * 0.2) * 10) / 10 },
      on_time_rate: { value: wAvg((m) => m.on_time_rate), previous: Math.round(wAvg((m) => m.on_time_rate) * (0.92 + rand() * 0.14) * 10) / 10 },
      avg_resolution_hours: { value: wAvg((m) => m.avg_resolution_hours), previous: Math.round(wAvg((m) => m.avg_resolution_hours) * (0.85 + rand() * 0.3)) },
    },
    status_breakdown,
    priority_breakdown,
    trend: buildTrend(filters.period, grandTotal, resolved + closed),
    projects: projectRows,
    members,
  };
}

export const MOCK_PROJECT_OPTIONS = MOCK_PROJECTS.map(({ id, name }) => ({ id, name }));

const ISSUE_TITLES = [
  'Login fails after password reset', 'Invoice PDF shows wrong totals', 'Push notifications delayed on Android',
  'Dashboard slow with large datasets', 'Export CSV drops unicode characters', 'Webhook retries not backing off',
  'Session expires mid-checkout', 'Search ignores archived projects', 'Report email sent twice', 'Timezone off by one in due dates',
  'Role change not reflected until relogin', 'Attachment upload stalls above 20MB',
];

const DETAIL_STATUS = [
  { name: 'Open', category: 'pending' as const }, { name: 'To Do', category: 'pending' as const },
  { name: 'In Progress', category: 'in_progress' as const }, { name: 'In Review', category: 'in_progress' as const },
  { name: 'Resolved', category: 'resolved' as const },
];

/** Mock of GET /reports/members/{id}: one person's breakdown, trend and open issues */
export function getMockMemberDetail(userId: number, filters: ReportFilters): MemberReportDetail | null {
  const overview = getMockReportsOverview(filters);
  const member = overview.members.find((m) => m.user.id === userId);
  if (!member) return null;

  const rand = mulberry32(userId * 977 + filters.period.length);
  const by_project = buildCells(filters.period)
    .filter((c) => c.userId === userId && (filters.project_id == null || c.projectId === filters.project_id))
    .map((c) => ({
      project_id: c.projectId,
      name: MOCK_PROJECTS.find((p) => p.id === c.projectId)!.name,
      assigned: cellTotal(c),
      done: c.byStatus[5] + c.byStatus[6],
    }));

  const projectNames = by_project.map((p) => p.name);
  const priorities: MemberIssueRow['priority'][] = ['critical', 'high', 'medium', 'medium', 'low'];
  const today = new Date();
  const issues: MemberIssueRow[] = Array.from({ length: Math.min(12, member.pending + member.in_progress) }, (_, i) => {
    const status = DETAIL_STATUS[Math.floor(rand() * 4)];
    const overdueDays = i < member.overdue ? 1 + Math.floor(rand() * 18) : 0;
    const due = new Date(today);
    due.setDate(due.getDate() - overdueDays + (overdueDays ? 0 : 1 + Math.floor(rand() * 10)));
    return {
      key: `${projectNames[i % projectNames.length].slice(0, 3).toUpperCase()}-${100 + Math.floor(rand() * 400)}`,
      title: ISSUE_TITLES[(i + userId) % ISSUE_TITLES.length],
      project: projectNames[i % projectNames.length],
      status: status.name, category: status.category,
      priority: priorities[Math.floor(rand() * priorities.length)],
      due_date: due.toISOString(), days_overdue: overdueDays,
    };
  }).sort((a, b) => b.days_overdue - a.days_overdue);

  return {
    member, by_project, issues,
    trend: buildTrend(filters.period, member.assigned, member.resolved + member.closed),
  };
}

// ---- Weekly email schedule (kept in localStorage until PUT /reports/schedule exists) ----

const SCHEDULE_KEY = 'ims.reports.schedule';

export const DEFAULT_SCHEDULE: ReportSchedule = {
  enabled: false, frequency: 'weekly', weekday: 1, time: '09:00', recipients: [],
  sections: ['summary', 'team', 'overdue'],
};

export function getMockSchedule(): ReportSchedule {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY);
    return raw ? { ...DEFAULT_SCHEDULE, ...JSON.parse(raw) } : DEFAULT_SCHEDULE;
  } catch {
    return DEFAULT_SCHEDULE;
  }
}

export function saveMockSchedule(schedule: ReportSchedule): void {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
}
