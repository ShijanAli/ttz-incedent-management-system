import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useRoleNames } from '@/redux/features/roles/use-role-names';
import { cn } from '@/lib/utils';

/** Radix Select can't use "" as a value */
const DEFAULT_ROLE = '__default__';

interface RoleSelectProps {
  /** Empty string means "the user's default role" */
  value: string;
  onChange: (role: string) => void;
  /** Offer "Default role" (send no role). Off where a concrete role is required. */
  allowDefault?: boolean;
  disabled?: boolean;
  className?: string;
}

/** Project role picker backed by the roles API */
export function RoleSelect({ value, onChange, allowDefault = true, disabled, className }: RoleSelectProps) {
  const { roleNames } = useRoleNames();
  // Keep a role that isn't in the list (e.g. renamed) selectable instead of blanking it
  const options = value && !roleNames.includes(value) ? [value, ...roleNames] : roleNames;

  return (
    <Select
      value={value || (allowDefault ? DEFAULT_ROLE : undefined)}
      onValueChange={(v) => onChange(v === DEFAULT_ROLE ? '' : v)}
      disabled={disabled}
    >
      <SelectTrigger className={cn('h-7 text-xs', className)}>
        <SelectValue placeholder="Select role" />
      </SelectTrigger>
      <SelectContent>
        {allowDefault && <SelectItem value={DEFAULT_ROLE}>User's default role</SelectItem>}
        {options.map((role) => (
          <SelectItem key={role} value={role}>{role}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
