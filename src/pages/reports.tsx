import { useMemo, useState } from 'react';
import { BarChart3, CalendarClock, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useTabParam } from '@/hooks/use-tab-param';
import { saveBlob } from '@/lib/download';
import { getMockReportsOverview, MOCK_PROJECT_OPTIONS } from '@/lib/reports/mock-reports';
import type { ReportPeriod } from '@/lib/reports/report-types';
import { PageHeader } from '@/components/shared/page-header';
import { ReportKpis } from '@/components/reports/report-kpis';
import { PriorityCard, StatusBreakdownCard, TrendCard } from '@/components/reports/report-overview-charts';
import { ProjectHealthCard } from '@/components/reports/project-health-table';
import { MemberPerformance } from '@/components/reports/member-performance';
import { WorkloadHeatmap } from '@/components/reports/workload-heatmap';
import { CustomersCard, OverdueAgingCard, SeverityCard, SlaCard } from '@/components/reports/report-risk';
import { MemberDetailSheet } from '@/components/reports/member-detail-sheet';
import { ReportScheduleDialog } from '@/components/reports/report-schedule-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const REPORT_TABS = ['overview', 'team', 'workload', 'risk', 'customers'] as const;

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '12m', label: 'Last 12 months' },
];

const ALL = 'all';

export default function ReportsPage() {
  const { session, hasPermission } = useAuth();
  const [tab, setTab] = useTabParam(REPORT_TABS, 'overview');
  const [projectId, setProjectId] = useState(ALL);
  const [period, setPeriod] = useState<ReportPeriod>('30d');
  const [memberId, setMemberId] = useState<number | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Mock for now: swap for the real query once the API follows ReportsOverview
  const report = useMemo(
    () => getMockReportsOverview({ project_id: projectId === ALL ? null : Number(projectId), period }),
    [projectId, period],
  );

  if (!session) return null;

  if (!hasPermission('reports.view')) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Reports" breadcrumbs={[{ label: 'Reports' }]} />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Access restricted</h3>
            <p className="mt-1 text-sm text-muted-foreground">You don&apos;t have permission to view reports.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canExport = hasPermission('reports.export');

  const exportCSV = () => {
    const headers = [
      'Member', 'Designation', 'Assigned', 'Resolved', 'Closed', 'In Progress', 'Pending', 'Overdue',
      'Resolution Rate %', 'Share of Output %', 'Share of Open Work %', 'On-time %', 'Avg Resolution Hours', 'Reopen %',
    ];
    const rows = report.members.map((m) => [
      m.user.name, m.user.designation ?? '', m.assigned, m.resolved, m.closed, m.in_progress, m.pending, m.overdue,
      m.resolution_rate, m.share_of_resolved, m.share_of_open, m.on_time_rate, m.avg_resolution_hours, m.reopen_rate,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    saveBlob(new Blob([csv], { type: 'text/csv' }), `team-performance-${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('Report exported', { description: `${rows.length} team members exported to CSV.` });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Reports & Analytics"
        description="Project delivery and team performance at a glance"
        breadcrumbs={[{ label: 'Reports' }]}
        actions={canExport && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setScheduleOpen(true)}>
              <CalendarClock className="mr-2 h-4 w-4" /> Schedule email
            </Button>
            <Button onClick={exportCSV}>
              <Download className="mr-2 h-4 w-4" /> Export team CSV
            </Button>
          </div>
        )}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All projects</SelectItem>
            {MOCK_PROJECT_OPTIONS.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
          <SelectTrigger className="w-full sm:w-[170px]"><SelectValue placeholder="Period" /></SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground sm:ml-auto">Sample data. Not connected to the API yet.</span>
      </div>

      <ReportKpis summary={report.summary} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 grid h-auto w-full grid-cols-2 sm:grid-cols-5 lg:w-[760px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="team">Team Performance</TabsTrigger>
          <TabsTrigger value="workload">Workload</TabsTrigger>
          <TabsTrigger value="risk">Risk & SLA</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <TrendCard data={report.trend} period={period} />
          <div className="grid gap-4 lg:grid-cols-2">
            <StatusBreakdownCard items={report.status_breakdown} />
            <PriorityCard items={report.priority_breakdown} />
          </div>
          <ProjectHealthCard projects={report.projects} />
        </TabsContent>

        <TabsContent value="team">
          <MemberPerformance members={report.members} onSelectMember={setMemberId} />
        </TabsContent>

        <TabsContent value="workload">
          <WorkloadHeatmap workload={report.workload} onSelectMember={setMemberId} />
        </TabsContent>

        <TabsContent value="risk" className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2"><OverdueAgingCard items={report.overdue_aging} /></div>
          <SlaCard sla={report.sla} />
        </TabsContent>

        <TabsContent value="customers" className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2"><CustomersCard customers={report.customers} /></div>
          <SeverityCard items={report.severity_breakdown} />
        </TabsContent>
      </Tabs>

      <MemberDetailSheet userId={memberId} filters={report.filters} onClose={() => setMemberId(null)} />
      <ReportScheduleDialog open={scheduleOpen} onOpenChange={setScheduleOpen} />
    </div>
  );
}
