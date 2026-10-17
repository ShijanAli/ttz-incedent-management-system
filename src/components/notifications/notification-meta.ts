import {
  Bell, FilePlus2, Hand, MessageSquare, Paperclip, Pencil, RefreshCw, ShieldCheck, Trash2, UserMinus, UserPlus,
  type LucideIcon,
} from 'lucide-react';
import type { NotificationEvent } from '@/redux/features/notifications/notifications-types';

interface NotificationMeta {
  label: string;
  icon: LucideIcon;
  /** Icon tile colors */
  color: string;
}

const EVENT_META: Record<string, NotificationMeta> = {
  'issue.created': { label: 'New issue', icon: FilePlus2, color: 'text-emerald-600 bg-emerald-50' },
  'issue.updated': { label: 'Issue updated', icon: Pencil, color: 'text-blue-600 bg-blue-50' },
  'issue.deleted': { label: 'Issue deleted', icon: Trash2, color: 'text-red-600 bg-red-50' },
  'issue.picked': { label: 'Issue picked up', icon: Hand, color: 'text-blue-600 bg-blue-50' },
  'issue.assigned': { label: 'Assigned', icon: UserPlus, color: 'text-blue-600 bg-blue-50' },
  'issue.unassigned': { label: 'Unassigned', icon: UserMinus, color: 'text-orange-600 bg-orange-50' },
  'issue.status_changed': { label: 'Status changed', icon: RefreshCw, color: 'text-amber-600 bg-amber-50' },
  'issue.reviewed': { label: 'Fix reviewed', icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-50' },
  'comment.created': { label: 'New comment', icon: MessageSquare, color: 'text-violet-600 bg-violet-50' },
  'comment.updated': { label: 'Comment edited', icon: MessageSquare, color: 'text-violet-600 bg-violet-50' },
  'comment.deleted': { label: 'Comment deleted', icon: MessageSquare, color: 'text-red-600 bg-red-50' },
  'attachment.added': { label: 'File attached', icon: Paperclip, color: 'text-cyan-600 bg-cyan-50' },
  'attachment.deleted': { label: 'File removed', icon: Paperclip, color: 'text-red-600 bg-red-50' },
};

/** Icon, color and a short title per event; unknown events get a generic bell */
export function getNotificationMeta(event: NotificationEvent): NotificationMeta {
  return (
    EVENT_META[event] ?? {
      label: event.replace(/[._]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
      icon: Bell,
      color: 'text-muted-foreground bg-muted',
    }
  );
}
