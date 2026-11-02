import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ProjectHealth, ProjectReportRow } from '@/lib/reports/report-types';

const HEALTH_META: Record<ProjectHealth, { label: string; className: string }> = {
  on_track: { label: 'On track', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  at_risk: { label: 'At risk', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  off_track: { label: 'Off track', className: 'border-red-200 bg-red-50 text-red-700' },
};

/** One row per project: stacked state bar, completion and a health flag */
export function ProjectHealthCard({ projects }: { projects: ProjectReportRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Project Health</CardTitle>
        <CardDescription>Progress and risk per project. Health looks at completion and the share of overdue issues.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {projects.map((p) => {
          const meta = HEALTH_META[p.health];
          const segments = [
            { key: 'done', value: p.resolved + p.closed, color: '#10b981' },
            { key: 'doing', value: p.in_progress, color: '#3b82f6' },
            { key: 'pending', value: p.pending, color: '#f59e0b' },
          ];
          return (
            <div key={p.id} className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  <Badge variant="outline" className={cn('px-1.5 py-0 text-[10px] font-medium', meta.className)}>{meta.label}</Badge>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {p.total} issues · <span className="font-medium text-foreground">{p.progress}%</span> done
                  {p.overdue > 0 && <span className="ml-1 text-red-600">· {p.overdue} overdue</span>}
                  <span className="ml-1">· {p.member_count} members</span>
                </span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                {segments.map((s) => (
                  <div key={s.key} className="h-full transition-all" style={{ width: `${p.total ? (s.value / p.total) * 100 : 0}%`, backgroundColor: s.color }} />
                ))}
              </div>
            </div>
          );
        })}
        <div className="flex flex-wrap gap-4 border-t pt-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Resolved / Closed</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" />In Progress</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Pending</span>
        </div>
      </CardContent>
    </Card>
  );
}
