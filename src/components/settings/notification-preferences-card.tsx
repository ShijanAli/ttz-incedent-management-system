import { Fragment } from 'react';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { parseApiError } from '@/lib/api-error';
import {
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
} from '@/redux/features/notifications/notifications-api';
import type { NotificationPreferences } from '@/redux/features/notifications/notifications-types';

const OPTIONS: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: 'email_notifications', label: 'Email notifications', description: 'Get alerts by email' },
  { key: 'push_notifications', label: 'Push notifications', description: 'Get push alerts on your devices' },
  { key: 'deadline_alerts', label: 'Deadline reminders', description: 'The day before an issue is due, and when it goes overdue' },
  { key: 'mention_alerts', label: 'Mentions', description: 'When someone @mentions you in a comment' },
];

/** Each switch saves on its own. The in-app bell is always on, so it has no switch. */
export function NotificationPreferencesCard() {
  const { data: prefs, isLoading, isError, error, refetch } = useGetNotificationPreferencesQuery();
  const [updatePrefs] = useUpdateNotificationPreferencesMutation();

  const toggle = async (key: keyof NotificationPreferences, value: boolean) => {
    try {
      await updatePrefs({ [key]: value }).unwrap();
    } catch (err) {
      toast.error('Failed to save preference', { description: parseApiError(err).message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Notification Preferences</CardTitle>
        </div>
        <CardDescription>Choose how you hear about activity. The in-app bell is always on.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          OPTIONS.map((o) => <Skeleton key={o.key} className="h-9 w-full" />)
        ) : isError || !prefs ? (
          <div className="py-4 text-center text-sm">
            <p className="text-destructive">{parseApiError(error, 'Failed to load preferences.').message}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : (
          OPTIONS.map((o, i) => (
            <Fragment key={o.key}>
              {i > 0 && <Separator />}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor={`pref-${o.key}`} className="text-sm">{o.label}</Label>
                  <p className="text-xs text-muted-foreground">{o.description}</p>
                </div>
                <Switch
                  id={`pref-${o.key}`}
                  checked={prefs[o.key]}
                  onCheckedChange={(v) => void toggle(o.key, v)}
                />
              </div>
            </Fragment>
          ))
        )}
      </CardContent>
    </Card>
  );
}
