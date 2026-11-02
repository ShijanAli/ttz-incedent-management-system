import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { UserAvatar } from '@/components/shared/user-avatar';
import { getAvatarColor } from '@/lib/shared-utils';
import { cn } from '@/lib/utils';
import { formatHours } from '@/components/reports/report-kpis';
import { getMockMemberDetail } from '@/lib/reports/mock-reports';
import type { ReportFilters } from '@/lib/reports/report-types';

const PRIORITY_CLASS: Record<string, string> = {
  critical: 'border-red-200 bg-red-50 text-red-700',
  high: 'border-orange-200 bg-orange-50 text-orange-700',
  medium: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  low: 'border-green-200 bg-green-50 text-green-700',
};

const trendConfig: ChartConfig = {
  created: { label: 'Assigned', color: '#6366f1' },
  resolved: { label: 'Resolved / Closed', color: '#10b981' },
};

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn('mt-0.5 text-lg font-bold tabular-nums', tone)}>{value}</div>
    </div>
  );
}

/** Drill-down for one person: numbers, trend, split by project and their open issues */
export function MemberDetailSheet({ userId, filters, onClose }: { userId: number | null; filters: ReportFilters; onClose: () => void }) {
  const detail = useMemo(() => (userId == null ? null : getMockMemberDetail(userId, filters)), [userId, filters]);
  const m = detail?.member;
  const fmt = (iso: string) => format(new Date(iso), filters.period === '12m' ? 'MMM' : 'd MMM');

  return (
    <Sheet open={userId != null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {detail && m ? (
          <>
            <SheetHeader className="text-left">
              <div className="flex items-center gap-3">
                <UserAvatar name={m.user.name} color={getAvatarColor(m.user.id)} size="md" />
                <div>
                  <SheetTitle>{m.user.name}</SheetTitle>
                  <SheetDescription>{m.user.designation ?? '—'}</SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <Stat label="Assigned" value={m.assigned} />
              <Stat label="Delivered" value={m.resolved + m.closed} tone="text-emerald-600" />
              <Stat label="Open" value={m.pending + m.in_progress} tone="text-amber-600" />
              <Stat label="Overdue" value={m.overdue} tone={m.overdue ? 'text-red-600' : undefined} />
              <Stat label="On-time" value={`${m.on_time_rate}%`} />
              <Stat label="Avg time" value={formatHours(m.avg_resolution_hours)} />
            </div>

            <div className="mt-5">
              <h4 className="mb-2 text-sm font-semibold">Trend</h4>
              <ChartContainer config={trendConfig} className="h-[170px] w-full">
                <AreaChart data={detail.trend} margin={{ left: -24, right: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={fmt} tickLine={false} axisLine={false} fontSize={11} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={fmt} />} />
                  <Area dataKey="created" type="monotone" stroke="var(--color-created)" fill="var(--color-created)" fillOpacity={0.12} strokeWidth={2} />
                  <Area dataKey="resolved" type="monotone" stroke="var(--color-resolved)" fill="var(--color-resolved)" fillOpacity={0.12} strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            </div>

            <div className="mt-5">
              <h4 className="mb-2 text-sm font-semibold">By project</h4>
              <div className="space-y-2.5">
                {detail.by_project.map((p) => {
                  const pctDone = p.assigned ? Math.round((p.done / p.assigned) * 100) : 0;
                  return (
                    <div key={p.project_id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">{p.name}</span>
                        <span className="tabular-nums text-muted-foreground">{p.done}/{p.assigned} · {pctDone}%</span>
                      </div>
                      <Progress value={pctDone} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 pb-4">
              <h4 className="mb-2 text-sm font-semibold">Open issues ({detail.issues.length})</h4>
              {detail.issues.length === 0 ? (
                <p className="rounded-lg border py-6 text-center text-sm text-muted-foreground">Nothing open. All caught up.</p>
              ) : (
                <ul className="space-y-2">
                  {detail.issues.map((i) => (
                    <li key={i.key} className="rounded-lg border p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{i.title}</div>
                          <div className="text-[11px] text-muted-foreground">{i.key} · {i.project} · {i.status}</div>
                        </div>
                        <Badge variant="outline" className={cn('shrink-0 px-1.5 py-0 text-[10px] capitalize', PRIORITY_CLASS[i.priority])}>{i.priority}</Badge>
                      </div>
                      <div className={cn('mt-1 text-[11px]', i.days_overdue ? 'font-medium text-red-600' : 'text-muted-foreground')}>
                        {i.days_overdue ? `${i.days_overdue} day${i.days_overdue !== 1 ? 's' : ''} overdue` : `Due ${format(new Date(i.due_date), 'd MMM')}`}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
