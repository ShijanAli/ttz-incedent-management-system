import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Flag, Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { parseApiError } from '@/lib/api-error';
import { sortStatuses, toStatusInputs } from '@/lib/project-utils';
import {
  useGetProjectStatusesQuery,
  useReplaceProjectStatusesMutation,
} from '@/redux/features/projects/projects-api';
import { useStatusCatalog } from '@/redux/features/projects/use-status-catalog';
import type { ProjectStatus } from '@/redux/features/projects/projects-types';
import { cn } from '@/lib/utils';

interface StatusWorkflowEditorProps {
  projectId: number;
  canEdit: boolean;
}

/** Loads the project's statuses, then hands them to the editor as its starting state */
export function StatusWorkflowEditor({ projectId, canEdit }: StatusWorkflowEditorProps) {
  const { data, isLoading, isError, error, refetch, fulfilledTimeStamp } = useGetProjectStatusesQuery(projectId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-2 p-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm">
          <p className="text-destructive">{parseApiError(error, 'Failed to load statuses.').message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  // Re-keyed on every fetch so a save (or another user's change) resets the draft
  return <WorkflowDraft key={fulfilledTimeStamp} projectId={projectId} initial={sortStatuses(data)} canEdit={canEdit} />;
}

function WorkflowDraft({
  projectId, initial, canEdit,
}: { projectId: number; initial: ProjectStatus[]; canEdit: boolean }) {
  const [draft, setDraft] = useState(initial);
  const [toAdd, setToAdd] = useState('');
  const { statuses: catalog } = useStatusCatalog({ skip: !canEdit });
  const [replaceStatuses, { isLoading: saving }] = useReplaceProjectStatusesMutation();

  const available = useMemo(
    () => catalog.filter((s) => !draft.some((d) => d.id === s.id)),
    [catalog, draft],
  );

  const dirty = useMemo(() => {
    const a = JSON.stringify(toStatusInputs(draft));
    const b = JSON.stringify(toStatusInputs(initial));
    return a !== b;
  }, [draft, initial]);

  const move = (index: number, delta: -1 | 1) => {
    setDraft((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });
  };

  const setInitial = (id: number) =>
    setDraft((prev) => prev.map((s) => ({ ...s, is_initial: s.id === id })));

  const toggleTerminal = (id: number, value: boolean) =>
    setDraft((prev) => prev.map((s) => (s.id === id ? { ...s, is_terminal: value } : s)));

  const removeStatus = (id: number) => setDraft((prev) => prev.filter((s) => s.id !== id));

  const addStatus = () => {
    const status = catalog.find((s) => String(s.id) === toAdd);
    if (!status) return;
    setDraft((prev) => [...prev, { ...status, is_initial: false }]);
    setToAdd('');
  };

  const save = async () => {
    try {
      await replaceStatuses({ projectId, statuses: toStatusInputs(draft) }).unwrap();
      toast.success('Workflow saved');
    } catch (err) {
      toast.error('Failed to save workflow', { description: parseApiError(err).message });
    }
  };

  const hasTerminal = draft.some((s) => s.is_terminal);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base">Workflow Statuses</CardTitle>
          <CardDescription>
            The order issues move through. New issues start in the <strong>initial</strong> status; <strong>final</strong> statuses close them.
          </CardDescription>
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => setDraft(initial)} disabled={!dirty || saving}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset
            </Button>
            <Button size="sm" onClick={save} disabled={!dirty || saving || draft.length === 0}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save workflow
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {draft.length === 0 && (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            A project needs at least one status.
          </p>
        )}

        {draft.map((status, index) => (
          <div
            key={status.id}
            className={cn('flex flex-wrap items-center gap-3 rounded-lg border p-3', status.is_initial && 'border-primary/40 bg-primary/[0.03]')}
          >
            <span className="w-5 text-center text-xs tabular-nums text-muted-foreground">{index + 1}</span>
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: status.color }} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                {status.name}
                {status.is_initial && <Badge className="text-[10px]">Initial</Badge>}
                {status.is_terminal && <Badge variant="secondary" className="text-[10px]"><Flag className="mr-1 h-2.5 w-2.5" />Final</Badge>}
              </div>
              <div className="font-mono text-[11px] text-muted-foreground">{status.slug}</div>
            </div>

            {canEdit && (
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                  <input
                    type="radio"
                    name="initial-status"
                    checked={status.is_initial}
                    onChange={() => setInitial(status.id)}
                    disabled={saving}
                    className="h-3.5 w-3.5"
                  />
                  Initial
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={status.is_terminal}
                    onCheckedChange={(v) => toggleTerminal(status.id, v === true)}
                    disabled={saving}
                  />
                  Final
                </label>
                <div className="flex">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(index, -1)} disabled={saving || index === 0} aria-label="Move up">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(index, 1)} disabled={saving || index === draft.length - 1} aria-label="Move down">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeStatus(status.id)}
                    disabled={saving || draft.length === 1}
                    aria-label={`Remove ${status.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {canEdit && draft.length > 0 && !hasTerminal && (
          <p className="text-xs text-amber-600">Tip: mark at least one status as final so issues can be closed.</p>
        )}

        {canEdit && available.length > 0 && (
          <div className="flex items-center gap-2 pt-2">
            <Select value={toAdd} onValueChange={setToAdd} disabled={saving}>
              <SelectTrigger className="h-9 max-w-xs">
                <SelectValue placeholder="Add a status..." />
              </SelectTrigger>
              <SelectContent>
                {available.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={addStatus} disabled={!toAdd || saving}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
