import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { IssueColoredRef, StatusUpdateBody } from '@/redux/features/issues/issues-types';

interface StatusUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** The project's workflow statuses, in order */
  statuses: IssueColoredRef[];
  initial: { status_id?: number; progress?: number };
  /** Hide the progress input and leave progress out of the body (the backend sets it) */
  hideProgress?: boolean;
  onSubmit: (body: StatusUpdateBody) => Promise<unknown>;
}

/** Status + progress + note, shared by "change my status" and "override an assignee's status" */
export function StatusUpdateDialog({
  open, onOpenChange, title, description, statuses, initial, hideProgress, onSubmit,
}: StatusUpdateDialogProps) {
  const [statusId, setStatusId] = useState('');
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStatusId(initial.status_id ? String(initial.status_id) : '');
    setProgress(initial.progress ?? 0);
    setNote('');
  }, [open, initial.status_id, initial.progress]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusId) return;
    setSaving(true);
    try {
      await onSubmit({
        status_id: Number(statusId),
        ...(!hideProgress && { progress }),
        ...(note.trim() && { note: note.trim() }),
      });
      onOpenChange(false);
    } catch {
      // The caller reports the error; keep the dialog open so nothing typed is lost
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="statusUpdateStatus">Status</Label>
            <Select value={statusId} onValueChange={setStatusId} disabled={saving}>
              <SelectTrigger id="statusUpdateStatus"><SelectValue placeholder="Select a status..." /></SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!hideProgress && <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="statusUpdateProgress">Progress</Label>
              <div className="flex items-center gap-1">
                <Input
                  id="statusUpdateProgress"
                  type="number"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={(e) => setProgress(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                  className="h-8 w-16 text-right"
                  disabled={saving}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <Slider
              value={[progress]}
              onValueChange={([v]) => setProgress(v)}
              max={100}
              step={5}
              disabled={saving}
              aria-label="Progress"
            />
          </div>}

          <div className="space-y-1.5">
            <Label htmlFor="statusUpdateNote">Note</Label>
            <Textarea
              id="statusUpdateNote"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What changed? (optional)"
              rows={3}
              disabled={saving}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || !statusId}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update status
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
