import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useRoleNames } from '@/redux/features/roles/use-role-names';
import { cn } from '@/lib/utils';

/** Radix Select can't use "" as a value */
const DEFAULT_ROLE = '__default__';

export interface RoleSelectOption {
  value: string;
  label: string;
}

interface RoleSelectProps {
  /** Empty string means "the user's default role" (or "no label" with custom options) */
  value: string;
  onChange: (role: string) => void;
  /** Offer "Default role" (send no role). Off where a concrete role is required. */
  allowDefault?: boolean;
  /** Pick from these instead of the roles API, e.g. project labels */
  options?: RoleSelectOption[];
  /** What the options are called in the placeholder and the empty choice */
  noun?: string;
  disabled?: boolean;
  className?: string;
}

/** Role picker backed by the roles API, or by custom options such as project labels */
export function RoleSelect({ value, onChange, allowDefault = true, options: customOptions, noun = 'role', disabled, className }: RoleSelectProps) {
  const { roleNames } = useRoleNames();
  const base: RoleSelectOption[] = customOptions ?? roleNames.map((r) => ({ value: r, label: r }));
  // Keep a value that isn't in the list (e.g. renamed) selectable instead of blanking it
  const options = value && !base.some((o) => o.value === value) ? [{ value, label: value }, ...base] : base;

  return (
    <Select
      value={value || (allowDefault ? DEFAULT_ROLE : undefined)}
      onValueChange={(v) => onChange(v === DEFAULT_ROLE ? '' : v)}
      disabled={disabled}
    >
      <SelectTrigger className={cn('h-7 text-xs', className)}>
        <SelectValue placeholder={`Select ${noun}`} />
      </SelectTrigger>
      <SelectContent>
        {allowDefault && (
          <SelectItem value={DEFAULT_ROLE}>{customOptions ? `No ${noun}` : "User's default role"}</SelectItem>
        )}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
