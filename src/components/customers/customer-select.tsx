import { Building2, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { useGetCustomersInfiniteQuery } from '@/redux/features/customers/customers-api';
import { InfiniteScrollTrigger } from '@/components/shared/infinite-scroll-trigger';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface CustomerSelectProps {
  id?: string;
  /** Customer id as a string ("" for none) */
  value: string;
  onChange: (customerId: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Picks the customer a complaint came from. Only active customers are offered; more
 * load as the list is scrolled. Super admins read the admin list, everyone else the
 * shared read-only one.
 */
export function CustomerSelect({ id, value, onChange, disabled, className }: CustomerSelectProps) {
  const { isSuperAdmin } = useAuth();
  const list = useInfiniteList(useGetCustomersInfiniteQuery({ admin: isSuperAdmin, is_active: 1 }));
  const customers = list.items;
  const selected = customers.find((c) => String(c.id) === value);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className={cn('gap-2 [&>span]:min-w-0', className)} title={selected?.name}>
        <SelectValue placeholder={list.showSkeleton ? 'Loading customers...' : 'Select customer...'} />
      </SelectTrigger>
      <SelectContent>
        {list.isError ? (
          <div className="px-2 py-3 text-center text-xs text-destructive">Failed to load customers.</div>
        ) : list.showSkeleton ? (
          <div className="flex items-center justify-center gap-2 px-2 py-3 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading customers...
          </div>
        ) : customers.length === 0 && !list.trigger.hasMore ? (
          <div className="px-2 py-3 text-center text-xs text-muted-foreground">
            No customers yet.{isSuperAdmin && ' Add them under Customers.'}
          </div>
        ) : (
          customers.map((c) => (
            <SelectItem key={c.id} value={String(c.id)} title={c.name}>
              <span className="flex min-w-0 items-center gap-2">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{c.name}</span>
                {c.code && <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{c.code}</span>}
              </span>
            </SelectItem>
          ))
        )}
        <InfiniteScrollTrigger {...list.trigger} disabled={list.trigger.disabled || list.showSkeleton} rootMargin="40px" />
      </SelectContent>
    </Select>
  );
}
