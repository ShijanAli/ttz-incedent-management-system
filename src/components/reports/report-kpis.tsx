import type { LucideIcon } from 'lucide-react';
import {
  ArrowDownRight, ArrowUpRight, CheckCircle2, CircleDashed, FolderKanban, Gauge, Hourglass, Layers,
  Loader2, Lock, Target, TimerOff,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ComparedValue, ReportSummary } from '@/lib/reports/report-types';

export const formatHours = (hours: number) => {
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${(hours / 24).toFixed(1)}d`;
};

/** Change vs the previous period. `lowerIsBetter` flips the colour for overdue / resolution time. */
function Delta({ value, previous, lowerIsBetter, suffix = '' }: ComparedValue & { lowerIsBetter?: boolean; suffix?: string }) {
  if (previous === 0 && value === 0) return <span className="text-[11px] text-muted-foreground">no change</span>;
  const diff = previous === 0 ? 100 : Math.round(((value - previous) / previous) * 100);
  if (diff === 0) return <span className="text-[11px] text-muted-foreground">no change{suffix}</span>;
  const up = diff > 0;
  const good = lowerIsBetter ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-medium', good ? 'text-emerald-600' : 'text-red-600')}>
      <Icon className="h-3 w-3" />
      {Math.abs(diff)}%<span className="ml-1 font-normal text-muted-foreground">vs prev</span>
    </span>
  );
}

interface KpiProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: string;
  compared?: ComparedValue;
  lowerIsBetter?: boolean;
  hint?: string;
}

function Kpi({ label, value, icon: Icon, tone, compared, lowerIsBetter, hint }: KpiProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', tone)}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <div className="mt-1 min-h-[16px]">
          {compared ? <Delta {...compared} lowerIsBetter={lowerIsBetter} /> : hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

/** Two rows of headline numbers: volume by state first, then quality / speed */
export function ReportKpis({ summary }: { summary: ReportSummary }) {
  const s = summary;
  return (
    <div className="mb-6 space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Total Projects" value={s.total_projects} icon={FolderKanban} tone="bg-indigo-50 text-indigo-600" hint={`${s.active_projects} active`} />
        <Kpi label="Total Issues" value={s.total_issues.value} icon={Layers} tone="bg-blue-50 text-blue-600" compared={s.total_issues} />
        <Kpi label="Pending" value={s.pending.value} icon={Hourglass} tone="bg-amber-50 text-amber-600" compared={s.pending} lowerIsBetter />
        <Kpi label="In Progress" value={s.in_progress.value} icon={Loader2} tone="bg-sky-50 text-sky-600" compared={s.in_progress} />
        <Kpi label="Resolved" value={s.resolved.value} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" compared={s.resolved} />
        <Kpi label="Closed" value={s.closed.value} icon={Lock} tone="bg-slate-100 text-slate-600" compared={s.closed} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Resolution Rate" value={`${s.resolution_rate.value}%`} icon={Target} tone="bg-violet-50 text-violet-600" compared={s.resolution_rate} />
        <Kpi label="On-time Delivery" value={`${s.on_time_rate.value}%`} icon={Gauge} tone="bg-teal-50 text-teal-600" compared={s.on_time_rate} />
        <Kpi label="Avg Resolution Time" value={formatHours(s.avg_resolution_hours.value)} icon={Hourglass} tone="bg-cyan-50 text-cyan-600" compared={s.avg_resolution_hours} lowerIsBetter />
        <Kpi label="Overdue" value={s.overdue.value} icon={TimerOff} tone="bg-red-50 text-red-600" compared={s.overdue} lowerIsBetter />
        <Kpi label="Unassigned" value={s.unassigned} icon={CircleDashed} tone="bg-orange-50 text-orange-600" hint="Nobody owns these yet" />
      </div>
    </div>
  );
}
