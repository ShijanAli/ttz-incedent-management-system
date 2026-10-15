import { StatusBadge } from '@/components/shared/status-badge';

export function GroupStatusBadge({ active }: { active: boolean }) {
  return active ? (
    <StatusBadge label="Active" className="border-emerald-200 bg-emerald-50 text-emerald-700" />
  ) : (
    <StatusBadge label="Inactive" className="border-slate-200 bg-slate-100 text-slate-600" />
  );
}
