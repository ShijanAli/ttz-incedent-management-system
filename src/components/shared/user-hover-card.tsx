import { Building2, Mail, Phone } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { UserAvatar } from '@/components/shared/user-avatar';
import { getAvatarColor } from '@/lib/shared-utils';

/** Whatever the API embeds for a user; only id and name are guaranteed */
export interface HoverCardUser {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  designation?: string | null;
  photo_url?: string | null;
}

interface UserHoverCardProps {
  user: HoverCardUser;
  children: React.ReactNode;
}

/**
 * Shows a user's contact card when their avatar is hovered. Events inside the card
 * stop here, so clicking the email in a board card doesn't open the issue or start a drag.
 */
export function UserHoverCard({ user, children }: UserHoverCardProps) {
  // Designation sits under the name in the header
  const rows = [
    { icon: Building2, value: user.department },
    { icon: Mail, value: user.email, href: user.email ? `mailto:${user.email}` : undefined },
    { icon: Phone, value: user.phone, href: user.phone ? `tel:${user.phone}` : undefined },
  ].filter((r) => r.value);

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <span className="inline-flex shrink-0 cursor-default rounded-full">{children}</span>
      </HoverCardTrigger>
      <HoverCardContent
        className="w-72 p-0"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b p-4">
          <UserAvatar name={user.name} color={getAvatarColor(user.id)} image={user.photo_url ?? undefined} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{user.name}</p>
            {user.designation && <p className="truncate text-xs text-muted-foreground">{user.designation}</p>}
          </div>
        </div>
        {rows.length > 0 ? (
          <ul className="space-y-2 p-4 text-sm">
            {rows.map(({ icon: Icon, value, href }, i) => (
              <li key={i} className="flex min-w-0 items-center gap-2.5">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                {href ? (
                  <a href={href} className="truncate hover:text-primary hover:underline">{value}</a>
                ) : (
                  <span className="truncate">{value}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No contact details.</p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
