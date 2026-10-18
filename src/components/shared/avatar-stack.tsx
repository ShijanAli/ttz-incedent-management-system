import { UserAvatar } from '@/components/shared/user-avatar';
import { UserHoverCard, type HoverCardUser } from '@/components/shared/user-hover-card';
import { getAvatarColor } from '@/lib/shared-utils';
import { cn } from '@/lib/utils';

interface AvatarStackProps {
  people: HoverCardUser[];
  /** Avatars shown before the rest collapse into a "+N" chip */
  max?: number;
  size?: 'xs' | 'sm';
  className?: string;
}

const CHIP_SIZE = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs' };

/** Overlapping avatars (photo or initials); hovering one shows that person's contact card */
export function AvatarStack({ people, max = 3, size = 'xs', className }: AvatarStackProps) {
  const shown = people.slice(0, max);
  const rest = people.slice(max);

  return (
    <div className={cn('flex items-center -space-x-2', className)}>
      {shown.map((p) => (
        <UserHoverCard key={p.id} user={p}>
          <UserAvatar
            name={p.name}
            color={getAvatarColor(p.id)}
            image={p.photo_url ?? undefined}
            size={size}
            className="ring-2 ring-background"
          />
        </UserHoverCard>
      ))}
      {rest.length > 0 && (
        <span
          title={rest.map((p) => p.name).join(', ')}
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-background',
            CHIP_SIZE[size],
          )}
        >
          +{rest.length}
        </span>
      )}
    </div>
  );
}
