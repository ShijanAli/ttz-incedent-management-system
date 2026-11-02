import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from '@/components/ui/chart';
import type {
  PriorityBreakdownItem, ReportPeriod, StatusBreakdownItem, StatusCategory, TrendPoint,
} from '@/lib/reports/report-types';

const CATEGORY_META: Record<StatusCategory, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#f59e0b' },
  in_progress: { label: 'In Progress', color: '#3b82f6' },
  resolved: { label: 'Resolved', color: '#10b981' },
  closed: { label: 'Closed', color: '#64748b' },
};

const PRIORITY_META: Record<PriorityBreakdownItem['priority'], { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#dc2626' },
  high: { label: 'High', color: '#f97316' },
  medium: { label: 'Medium', color: '#eab308' },
  low: { label: 'Low', color: '#22c55e' },
};

/** Donut by state bucket + a per-status list with count and ratio */
export function StatusBreakdownCard({ items }: { items: StatusBreakdownItem[] }) {
  const total = items.reduce((a, i) => a + i.count, 0);
  const byCategory = (Object.keys(CATEGORY_META) as StatusCategory[]).map((key) => ({
    key,
    ...CATEGORY_META[key],
    count: items.filter((i) => i.category === key).reduce((a, i) => a + i.count, 0),
  }));
  const config: ChartConfig = Object.fromEntries(byCategory.map((c) => [c.key, { label: c.label, color: c.color }]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Issue States</CardTitle>
        <CardDescription>Count and share of every workflow status</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
        <div className="relative mx-auto h-[180px] w-[180px]">
          <ChartContainer config={config} className="h-full w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="key" />} />
              <Pie data={byCategory} dataKey="count" nameKey="key" innerRadius={58} outerRadius={84} paddingAngle={2} strokeWidth={0}>
                {byCategory.map((c) => <Cell key={c.key} fill={c.color} />)}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">{total}</span>
            <span className="text-[11px] text-muted-foreground">issues</span>
          </div>
        </div>

        <div className="space-y-2.5">
          {items.map((s) => (
            <div key={s.status_id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{CATEGORY_META[s.category].label}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  <span className="font-medium text-foreground">{s.count}</span> · {s.ratio}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full transition-all" style={{ width: `${s.ratio}%`, backgroundColor: s.color }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Total vs still-open issues per priority, so critical backlog stands out */
export function PriorityCard({ items }: { items: PriorityBreakdownItem[] }) {
  const data = items.map((i) => ({ ...i, label: PRIORITY_META[i.priority].label, color: PRIORITY_META[i.priority].color }));
  const config: ChartConfig = {
    count: { label: 'Total', color: 'hsl(var(--muted-foreground) / 0.35)' },
    open: { label: 'Still open', color: 'hsl(var(--primary))' },
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Priority Mix</CardTitle>
        <CardDescription>Total issues vs. the part still open, by priority</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[200px] w-full">
          <BarChart data={data} margin={{ left: -16, right: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="open" fill="var(--color-open)" radius={[4, 4, 0, 0]} />
            <ChartLegend content={<ChartLegendContent />} />
          </BarChart>
        </ChartContainer>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          {data.map((d) => (
            <div key={d.priority} className="rounded-md border px-2 py-1.5">
              <div className="text-[11px] text-muted-foreground">{d.label}</div>
              <div className="text-sm font-semibold" style={{ color: d.color }}>{d.ratio}%</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const TREND_LABEL: Record<ReportPeriod, string> = {
  '7d': 'daily', '30d': 'daily', '90d': 'weekly', '12m': 'monthly',
};

/** Created vs resolved over time: when the gap opens, the backlog is growing */
export function TrendCard({ data, period }: { data: TrendPoint[]; period: ReportPeriod }) {
  const config: ChartConfig = {
    created: { label: 'Created', color: '#6366f1' },
    resolved: { label: 'Resolved / Closed', color: '#10b981' },
  };
  const fmt = (iso: string) => format(new Date(iso), period === '12m' ? 'MMM' : 'd MMM');
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Created vs Resolved</CardTitle>
        <CardDescription>Throughput trend ({TREND_LABEL[period]}). Resolved above created means the backlog is shrinking.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[260px] w-full">
          <AreaChart data={data} margin={{ left: -16, right: 8 }}>
            <defs>
              {(['created', 'resolved'] as const).map((k) => (
                <linearGradient key={k} id={`fill-${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={`var(--color-${k})`} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={`var(--color-${k})`} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={fmt} tickLine={false} axisLine={false} fontSize={12} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={fmt} />} />
            <Area dataKey="created" type="monotone" stroke="var(--color-created)" fill="url(#fill-created)" strokeWidth={2} />
            <Area dataKey="resolved" type="monotone" stroke="var(--color-resolved)" fill="url(#fill-resolved)" strokeWidth={2} />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
