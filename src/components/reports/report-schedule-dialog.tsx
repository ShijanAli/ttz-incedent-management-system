import { useEffect, useState } from 'react';
import { CalendarClock, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { getMockSchedule, saveMockSchedule } from '@/lib/reports/mock-reports';
import type { ReportSchedule, ScheduleSection } from '@/lib/reports/report-types';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SECTIONS: { value: ScheduleSection; label: string }[] = [
  { value: 'summary', label: 'Headline numbers' },
  { value: 'team', label: 'Team performance' },
  { value: 'projects', label: 'Project health' },
  { value: 'overdue', label: 'Overdue & SLA risks' },
];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Set up a recurring email of this report. Saved locally until the schedule API exists. */
export function ReportScheduleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [schedule, setSchedule] = useState<ReportSchedule>(getMockSchedule);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setSchedule(getMockSchedule()); setDraft(''); setError(''); }
  }, [open]);

  const patch = (changes: Partial<ReportSchedule>) => setSchedule((s) => ({ ...s, ...changes }));

  const addRecipient = () => {
    const email = draft.trim().toLowerCase();
    if (!email) return true;
    if (!EMAIL.test(email)) { setError('Enter a valid email address'); return false; }
    if (!schedule.recipients.includes(email)) patch({ recipients: [...schedule.recipients, email] });
    setDraft(''); setError('');
    return true;
  };

  const toggleSection = (section: ScheduleSection, on: boolean) =>
    patch({ sections: on ? [...schedule.sections, section] : schedule.sections.filter((s) => s !== section) });

  const save = () => {
    // An address typed but not yet added still counts
    const typed = draft.trim().toLowerCase();
    if (typed && !EMAIL.test(typed)) { setError('Enter a valid email address'); return; }
    const next = { ...schedule, recipients: typed ? [...new Set([...schedule.recipients, typed])] : schedule.recipients };
    if (next.enabled && next.recipients.length === 0) { setError('Add at least one recipient'); return; }
    if (next.enabled && next.sections.length === 0) { setError('Pick at least one section'); return; }
    saveMockSchedule(next);
    toast.success(next.enabled ? 'Report schedule saved' : 'Scheduled report turned off');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" /> Scheduled report</DialogTitle>
          <DialogDescription>Email this report to the owners automatically.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium">Send automatically</span>
            <Switch checked={schedule.enabled} onCheckedChange={(enabled) => patch({ enabled })} />
          </label>

          <div className={schedule.enabled ? 'space-y-4' : 'pointer-events-none space-y-4 opacity-50'}>
            <div className="grid grid-cols-3 gap-2">
              <Select value={schedule.frequency} onValueChange={(v) => patch({ frequency: v as ReportSchedule['frequency'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={String(schedule.weekday)}
                onValueChange={(v) => patch({ weekday: Number(v) })}
                disabled={schedule.frequency !== 'weekly'}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d, i) => <SelectItem key={d} value={String(i)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="time" value={schedule.time} onChange={(e) => patch({ time: e.target.value })} />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Recipients</div>
              <div className="flex gap-2">
                <Input
                  placeholder="owner@company.com"
                  value={draft}
                  onChange={(e) => { setDraft(e.target.value); setError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRecipient(); } }}
                />
                <Button type="button" variant="outline" onClick={addRecipient}>Add</Button>
              </div>
              {schedule.recipients.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {schedule.recipients.map((r) => (
                    <Badge key={r} variant="secondary" className="gap-1 font-normal">
                      {r}
                      <button type="button" aria-label={`Remove ${r}`} onClick={() => patch({ recipients: schedule.recipients.filter((x) => x !== r) })}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Include</div>
              <div className="grid grid-cols-2 gap-2">
                {SECTIONS.map((s) => (
                  <label key={s.value} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={schedule.sections.includes(s.value)} onCheckedChange={(c) => toggleSection(s.value, c === true)} />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Save schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
