import { useMemo, useState } from 'react';
import { AlertTriangle, Award, Scale, TrendingDown } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from '@/components/ui/chart';
import { UserAvatar } from '@/components/shared/user-avatar';
import { getAvatarColor } from '@/lib/shared-utils';
import { cn } from '@/lib/utils';
import { formatHours } from '@/components/reports/report-kpis';
import type { MemberReportRow } from '@/lib/reports/report-types';

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316', '#64748b'];

const firstName = (name: string) => name.split(' ')[0];

interface Insight {
  icon: typeof Award;
  tone: string;
  title: string;
  text: string;
}

/** Plain-language callouts so an owner doesn't have to read the whole table */
function buildInsights(members: MemberReportRow[]): Insight[] {
  if (members.length === 0) return [];
  const insights: Insight[] = [];
  // Only rank people with enough work for the rate to mean something
  const sampled = members.filter((m) => m.assigned >= 5);

  const top = [...members].sort((a, b) => b.resolved + b.closed - (a.resolved + a.closed))[0];
  insights.push({
    icon: Award, tone: 'bg-emerald-50 text-emerald-700',
    title: 'Top performer',
    text: `${top.user.name} delivered ${top.resolved + top.closed} issues (${top.share_of_resolved}% of all output) at a ${top.resolution_rate}% resolution rate.`,
  });

  const loaded = [...members].sort((a, b) => b.share_of_open - a.share_of_open)[0];
  const fairShare = 100 / members.length;
  if (loaded.share_of_open > fairShare * 1.4) {
    insights.push({
      icon: Scale, tone: 'bg-amber-50 text-amber-700',
      title: 'Workload imbalance',
      text: `${loaded.user.name} carries ${loaded.share_of_open}% of open work. An even split would be about ${Math.round(fairShare)}%. Consider reassigning.`,
    });
  }

  const slow = [...sampled].sort((a, b) => a.resolution_rate - b.resolution_rate)[0];
  if (slow && slow.resolution_rate < 60) {
    insights.push({
      icon: TrendingDown, tone: 'bg-red-50 text-red-700',
      title: 'Needs support',
      text: `${slow.user.name} has resolved only ${slow.resolution_rate}% of assigned issues with ${slow.overdue} overdue. Worth a check-in.`,
    });
  }

  const quality = [...sampled].sort((a, b) => b.reopen_rate - a.reopen_rate)[0];
  if (quality && quality.reopen_rate >= 10) {
    insights.push({
      icon: AlertTriangle, tone: 'bg-violet-50 text-violet-700',
      title: 'Quality watch',
      text: `${quality.reopen_rate}% of ${firstName(quality.user.name)}'s resolved issues were reopened, the highest on the team.`,
    });
  }
  return insights;
}

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(...values, 1);
  const w = 72;
  const h = 22;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 2 - (v / max) * (h - 4)}`).join(' ');
  return (
    <svg width={w} height={h} className={className} aria-hidden>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const rateTone = (rate: number) => (rate >= 75 ? 'text-emerald-600' : rate >= 55 ? 'text-amber-600' : 'text-red-600');

/** Per-person output: who resolved what, their share of the whole, and how reliably */
export function MemberPerformance({ members, onSelectMember }: { members: MemberReportRow[]; onSelectMember?: (userId: number) => void }) {
  const [share, setShare] = useState<'resolved' | 'open'>('resolved');
  const insights = useMemo(() => buildInsights(members), [members]);

  const barData = useMemo(
    () => members.map((m) => ({
      name: firstName(m.user.name),
      done: m.resolved + m.closed,
      in_progress: m.in_progress,
      pending: m.pending,
    })),
    [members],
  );
  const barConfig: ChartConfig = {
    done: { label: 'Resolved / Closed', color: '#10b981' },
    in_progress: { label: 'In Progress', color: '#3b82f6' },
    pending: { label: 'Pending', color: '#f59e0b' },
  };

  const donutData = useMemo(
    () => members
      .map((m, i) => ({
        name: m.user.name,
        value: share === 'resolved' ? m.resolved + m.closed : m.pending + m.in_progress,
        ratio: share === 'resolved' ? m.share_of_resolved : m.share_of_open,
        color: PALETTE[i % PALETTE.length],
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value),
    [members, share],
  );
  const donutTotal = donutData.reduce((a, d) => a + d.value, 0);

  if (members.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">No assigned issues in this period.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {insights.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {insights.map((i) => (
            <div key={i.title} className="flex gap-3 rounded-xl border bg-card p-3.5">
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', i.tone)}>
                <i.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold">{i.title}</div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{i.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Issues by Team Member</CardTitle>
            <CardDescription>What each person was assigned and where it stands</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={barConfig} className="w-full" style={{ height: Math.max(220, members.length * 44 + 40) }}>
              <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 16 }} barSize={18}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} width={64} />
                <ChartTooltip cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} content={<ChartTooltipContent />} />
                <Bar dataKey="done" stackId="a" fill="var(--color-done)" />
                <Bar dataKey="in_progress" stackId="a" fill="var(--color-in_progress)" />
                <Bar dataKey="pending" stackId="a" fill="var(--color-pending)" radius={[0, 4, 4, 0]} />
                <ChartLegend content={<ChartLegendContent />} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">Distribution</CardTitle>
                <CardDescription>{share === 'resolved' ? "Each person's share of finished work" : "Each person's share of open work"}</CardDescription>
              </div>
              <Tabs value={share} onValueChange={(v) => setShare(v as 'resolved' | 'open')}>
                <TabsList className="h-8">
                  <TabsTrigger value="resolved" className="px-2.5 text-xs">Output</TabsTrigger>
                  <TabsTrigger value="open" className="px-2.5 text-xs">Workload</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative mx-auto h-[170px] w-[170px]">
              <ChartContainer config={{}} className="h-full w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="name" />} />
                  <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                    {donutData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold">{donutTotal}</span>
                <span className="text-[11px] text-muted-foreground">{share === 'resolved' ? 'delivered' : 'open'}</span>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5">
              {donutData.map((d) => (
                <li key={d.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.name}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    <span className="font-medium text-foreground">{d.value}</span> · {d.ratio}%
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Leaderboard</CardTitle>
          <CardDescription>Ranked by issues delivered. Rates are measured against what each person was assigned. Click a row for details.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Assigned</TableHead>
                  <TableHead className="text-right">Resolved</TableHead>
                  <TableHead className="text-right">Closed</TableHead>
                  <TableHead className="text-right">In Progress</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Overdue</TableHead>
                  <TableHead className="min-w-[150px]">Resolution Rate</TableHead>
                  <TableHead className="text-right">On-time</TableHead>
                  <TableHead className="text-right">Avg Time</TableHead>
                  <TableHead className="text-right">Reopened</TableHead>
                  <TableHead>Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m, idx) => (
                  <TableRow key={m.user.id} className="cursor-pointer" onClick={() => onSelectMember?.(m.user.id)}>
                    <TableCell className="text-sm text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserAvatar name={m.user.name} color={getAvatarColor(m.user.id)} size="xs" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-sm font-medium">
                            {m.user.name}
                            {idx === 0 && <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">Top</Badge>}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">{m.user.designation ?? '—'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{m.assigned}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-emerald-600">{m.resolved}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-slate-600">{m.closed}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-blue-600">{m.in_progress}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-amber-600">{m.pending}</TableCell>
                    <TableCell className={cn('text-right text-sm tabular-nums', m.overdue > 0 ? 'font-medium text-red-600' : 'text-muted-foreground')}>
                      {m.overdue}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={m.resolution_rate} className="h-1.5 flex-1" />
                        <span className={cn('w-12 text-right text-xs font-semibold tabular-nums', rateTone(m.resolution_rate))}>{m.resolution_rate}%</span>
                      </div>
                    </TableCell>
                    <TableCell className={cn('text-right text-sm tabular-nums', rateTone(m.on_time_rate))}>{m.on_time_rate}%</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{formatHours(m.avg_resolution_hours)}</TableCell>
                    <TableCell className={cn('text-right text-sm tabular-nums', m.reopen_rate >= 10 ? 'text-red-600' : 'text-muted-foreground')}>
                      {m.reopen_rate}%
                    </TableCell>
                    <TableCell><Sparkline values={m.resolved_trend} className="text-primary" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
