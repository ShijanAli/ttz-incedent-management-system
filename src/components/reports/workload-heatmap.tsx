import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserAvatar } from '@/components/shared/user-avatar';
import { getAvatarColor } from '@/lib/shared-utils';
import { cn } from '@/lib/utils';
import type { WorkloadMatrix } from '@/lib/reports/report-types';

/** Cell shade grows with open issues relative to the busiest cell */
const shade = (open: number, max: number) => {
  if (open === 0) return 'bg-muted/40 text-muted-foreground';
  const r = open / max;
  if (r > 0.75) return 'bg-indigo-600 text-white';
  if (r > 0.5) return 'bg-indigo-400 text-white';
  if (r > 0.25) return 'bg-indigo-200 text-indigo-900';
  return 'bg-indigo-100 text-indigo-900';
};

const utilTone = (u: number) => (u > 100 ? 'text-red-600' : u > 80 ? 'text-amber-600' : 'text-emerald-600');
const utilBar = (u: number) => (u > 100 ? 'bg-red-500' : u > 80 ? 'bg-amber-500' : 'bg-emerald-500');

/** Member x project grid of open issues, plus how full each person's plate is */
export function WorkloadHeatmap({ workload, onSelectMember }: { workload: WorkloadMatrix; onSelectMember?: (userId: number) => void }) {
  const { projects, members, cells } = workload;
  const cellOf = (u: number, p: number) => cells.find((c) => c.user_id === u && c.project_id === p)?.open;
  const max = Math.max(...cells.map((c) => c.open), 1);
  const overloaded = members.filter((m) => m.utilization > 100);
  const spare = members.filter((m) => m.utilization < 60);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Workload Heatmap</CardTitle>
        <CardDescription>Open issues per person and project. Utilization compares open work with each person's capacity.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {overloaded.length > 0 && (
          <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-semibold">{overloaded.map((m) => m.name).join(', ')}</span>{' '}
              {overloaded.length === 1 ? 'is' : 'are'} over capacity.
              {spare.length > 0 && <> {spare.map((m) => m.name).join(', ')} {spare.length === 1 ? 'has' : 'have'} room to take work over.</>}
            </p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th className="min-w-[160px] text-left text-xs font-medium text-muted-foreground">Member</th>
                {projects.map((p) => (
                  <th key={p.id} className="min-w-[88px] px-1 text-center text-xs font-medium text-muted-foreground">{p.name}</th>
                ))}
                <th className="min-w-[160px] text-left text-xs font-medium text-muted-foreground">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id}>
                  <td>
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-md py-1 text-left hover:text-primary"
                      onClick={() => onSelectMember?.(m.user_id)}
                    >
                      <UserAvatar name={m.name} color={getAvatarColor(m.user_id)} size="xs" />
                      <span className="truncate text-sm font-medium">{m.name}</span>
                    </button>
                  </td>
                  {projects.map((p) => {
                    const open = cellOf(m.user_id, p.id);
                    return (
                      <td key={p.id}>
                        <div
                          className={cn('flex h-9 items-center justify-center rounded-md text-xs font-semibold tabular-nums', open == null ? 'bg-transparent text-muted-foreground/40' : shade(open, max))}
                          title={open == null ? 'Not on this project' : `${open} open`}
                        >
                          {open ?? '–'}
                        </div>
                      </td>
                    );
                  })}
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className={cn('h-full rounded-full', utilBar(m.utilization))} style={{ width: `${Math.min(m.utilization, 100)}%` }} />
                      </div>
                      <span className={cn('w-20 text-right text-xs font-semibold tabular-nums', utilTone(m.utilization))}>
                        {m.open}/{m.capacity} · {m.utilization}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
