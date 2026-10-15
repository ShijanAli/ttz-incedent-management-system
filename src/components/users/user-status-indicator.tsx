import { getUserStatusMeta } from '@/lib/shared-utils';
import { cn } from '@/lib/utils';

export function UserStatusIndicator({ status, className }: { status: string; className?: string }) {
  const meta = getUserStatusMeta(status);
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', meta.textClass, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dotClass)} />
      {meta.label}
    </span>
  );
}
