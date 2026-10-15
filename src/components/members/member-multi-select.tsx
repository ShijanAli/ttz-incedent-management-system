import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, Search, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/shared/user-avatar';
import { getAvatarColor } from '@/lib/shared-utils';
import { cn } from '@/lib/utils';

export interface MemberOption {
  id: number;
  name: string;
  designation?: string | null;
}

interface MemberMultiSelectProps {
  options: MemberOption[];
  value: number[];
  onChange: (ids: number[]) => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}

/** Pick several people from a known list (e.g. a project's members), shown as removable chips */
export function MemberMultiSelect({
  options, value, onChange, loading, disabled, placeholder = 'Select people...', id,
}: MemberMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = useMemo(() => new Set(value), [value]);
  const selectedOptions = options.filter((o) => selected.has(o.id));
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q) || (o.designation ?? '').toLowerCase().includes(q));
  }, [options, search]);

  const toggle = (optionId: number) =>
    onChange(selected.has(optionId) ? value.filter((v) => v !== optionId) : [...value, optionId]);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || loading}
            className="w-full justify-between font-normal"
          >
            <span className={cn('truncate', value.length === 0 && 'text-muted-foreground')}>
              {loading ? 'Loading members...' : value.length === 0 ? placeholder : `${value.length} selected`}
            </span>
            {loading ? <Loader2 className="h-4 w-4 animate-spin opacity-50" /> : <ChevronsUpDown className="h-4 w-4 opacity-50" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[240px] p-2" align="start">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="h-8 pl-8 text-sm"
              aria-label="Search people"
            />
          </div>
          <div className="max-h-[220px] overflow-y-auto" role="listbox" aria-multiselectable="true">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">No people found.</div>
            ) : (
              filtered.map((o) => {
                const checked = selected.has(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="option"
                    aria-selected={checked}
                    onClick={() => toggle(o.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                        checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                      )}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                    <UserAvatar name={o.name} color={getAvatarColor(o.id)} size="xs" />
                    <span className="min-w-0 flex-1 truncate">
                      {o.name}
                      {o.designation && <span className="text-muted-foreground"> · {o.designation}</span>}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {value.length > 0 && (
            <div className="mt-2 flex justify-end border-t pt-2">
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onChange([])}>
                Clear all
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedOptions.map((o) => (
            <Badge key={o.id} variant="secondary" className="gap-1.5 py-0.5 pl-0.5 pr-1.5 font-normal">
              <UserAvatar name={o.name} color={getAvatarColor(o.id)} size="xs" />
              {o.name}
              <button
                type="button"
                onClick={() => toggle(o.id)}
                className="rounded-full text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${o.name}`}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
