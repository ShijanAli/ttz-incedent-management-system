import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';
import { AlertOctagon, ShieldCheck, Timer } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from '@/components/ui/chart';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type {
  CustomerReportRow, OverdueAgingItem, Severity, SeverityBreakdownItem, SlaSummary,
} from '@/lib/reports/report-types';

const AGING_COLORS = ['#fbbf24', '#f97316', '#ef4444', '#991b1b'];

/** How long overdue issues have been overdue. Old buckets are the ones that hurt trust. */
export function OverdueAgingCard({ items }: { items: OverdueAgingItem[] }) {
  const total = items.reduce((a, i) => a + i.count, 0);
  const config: ChartConfig = {
    count: { label: 'Overdue issues', color: '#ef4444' },
    urgent: { label: 'Critical / High', color: '#7f1d1d' },
  };
  const oldest = items[items.length - 1];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Overdue Aging</CardTitle>
        <CardDescription>{total} overdue issues by how many days past due</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[220px] w-full">
          <BarChart data={items} margin={{ left: -16, right: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="bucket" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {items.map((_, i) => <Cell key={i} fill={AGING_COLORS[i]} />)}
            </Bar>
            <Bar dataKey="urgent" fill="var(--color-urgent)" radius={[4, 4, 0, 0]} />
            <ChartLegend content={<ChartLegendContent />} />
          </BarChart>
        </ChartContainer>
        {oldest.count > 0 && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            {oldest.count} issue{oldest.count !== 1 ? 's are' : ' is'} more than 15 days late. These are the first to escalate.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function SlaCard({ sla }: { sla: SlaSummary }) {
  const rows = [
    { icon: AlertOctagon, tone: 'bg-red-50 text-red-600', label: 'SLA breached', value: sla.breached, hint: 'Open and past target' },
    { icon: Timer, tone: 'bg-amber-50 text-amber-600', label: 'Breaching in 24h', value: sla.at_risk, hint: 'Needs attention today' },
    { icon: ShieldCheck, tone: 'bg-emerald-50 text-emerald-600', label: 'SLA met', value: `${sla.met_rate.value}%`, hint: `${sla.met_rate.previous}% previous period` },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">SLA Status</CardTitle>
        <CardDescription>Response and resolution targets</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 rounded-lg border p-3">
            <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', r.tone)}><r.icon className="h-5 w-5" /></span>
            <div className="flex-1">
              <div className="text-sm font-medium">{r.label}</div>
              <div className="text-xs text-muted-foreground">{r.hint}</div>
            </div>
            <div className="text-xl font-bold tabular-nums">{r.value}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const SEVERITY_META: Record<Severity, { label: string; color: string }> = {
  blocker: { label: 'Blocker', color: '#dc2626' },
  major: { label: 'Major', color: '#f97316' },
  minor: { label: 'Minor', color: '#3b82f6' },
  trivial: { label: 'Trivial', color: '#94a3b8' },
};

export function SeverityCard({ items }: { items: SeverityBreakdownItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Severity</CardTitle>
        <CardDescription>Impact of reported issues and how much is still open</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3.5">
        {items.map((s) => {
          const meta = SEVERITY_META[s.severity];
          const openPct = s.total ? Math.round((s.open / s.total) * 100) : 0;
          return (
            <div key={s.severity} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                  {meta.label}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  <span className="font-medium text-foreground">{s.total}</span> · {s.ratio}% · {s.open} open
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                <div className="absolute inset-y-0 left-0 rounded-full opacity-30" style={{ width: `${s.ratio * 2}%`, backgroundColor: meta.color }} />
                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(s.ratio * 2 * openPct) / 100}%`, backgroundColor: meta.color }} />
              </div>
            </div>
          );
        })}
        <p className="pt-1 text-[11px] text-muted-foreground">Light bar is total, solid bar is the part still open.</p>
      </CardContent>
    </Card>
  );
}

/** Which customers generate the most issues, and where they are waiting longest */
export function CustomersCard({ customers }: { customers: CustomerReportRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Issues by Customer</CardTitle>
        <CardDescription>Volume, open backlog and overdue per customer</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Open</TableHead>
                <TableHead className="text-right">Resolved</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
                <TableHead className="min-w-[150px]">Share of all issues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-sm font-medium">{c.name}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{c.total}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-amber-600">{c.open}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-emerald-600">{c.resolved}</TableCell>
                  <TableCell className={cn('text-right text-sm tabular-nums', c.overdue > 0 ? 'font-medium text-red-600' : 'text-muted-foreground')}>{c.overdue}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={c.ratio} className="h-1.5 flex-1" />
                      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{c.ratio}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
