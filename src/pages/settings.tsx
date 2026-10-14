import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { settingsRepo, preferencesRepo } from '@/lib/repository';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ProfileCard } from '@/components/settings/profile-card';
import { PasswordCard } from '@/components/settings/password-card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Save, Settings as SettingsIcon, Bell } from 'lucide-react';
import { toast } from 'sonner';
import type { IssueStatus } from '@/lib/types';

export default function SettingsPage() {
  const { session, hasPermission } = useAuth();

  const [systemSettings, setSystemSettings] = useState(() => settingsRepo.get());
  const [preferences, setPreferences] = useState(() =>
    session ? preferencesRepo.get(session.user.id) : null
  );

  if (!session) return null;

  if (!hasPermission('settings.view')) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Settings" breadcrumbs={[{ label: 'Settings' }]} />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <SettingsIcon className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Access restricted</h3>
            <p className="mt-1 text-sm text-muted-foreground">You don&apos;t have permission to view settings.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSuperAdmin = session.roleNames.includes('Super Admin');
  const canUpdateSettings = hasPermission('settings.update');

  const saveSystem = () => {
    if (!canUpdateSettings) {
      toast.error('You do not have permission to update system settings');
      return;
    }
    const updated = settingsRepo.update(systemSettings);
    setSystemSettings(updated);
    toast.success('System settings saved');
  };

  const savePreferences = () => {
    if (!preferences) return;
    const updated = preferencesRepo.update(session.user.id, preferences);
    setPreferences(updated);
    toast.success('Preferences saved');
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Settings"
        description="Manage your preferences and system configuration"
        breadcrumbs={[{ label: 'Settings' }]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileCard />

        {/* Notification preferences */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Notification Preferences</CardTitle>
            </div>
            <CardDescription>Control how you receive alerts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {preferences && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Email notifications</Label>
                    <p className="text-xs text-muted-foreground">Receive alerts via email</p>
                  </div>
                  <Switch
                    checked={preferences.emailNotifications}
                    onCheckedChange={(v) => setPreferences({ ...preferences, emailNotifications: v })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Push notifications</Label>
                    <p className="text-xs text-muted-foreground">In-app push alerts</p>
                  </div>
                  <Switch
                    checked={preferences.pushNotifications}
                    onCheckedChange={(v) => setPreferences({ ...preferences, pushNotifications: v })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Deadline alerts</Label>
                    <p className="text-xs text-muted-foreground">Notify me about upcoming deadlines</p>
                  </div>
                  <Switch
                    checked={preferences.deadlineAlerts}
                    onCheckedChange={(v) => setPreferences({ ...preferences, deadlineAlerts: v })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Mention alerts</Label>
                    <p className="text-xs text-muted-foreground">Notify me when mentioned in comments</p>
                  </div>
                  <Switch
                    checked={preferences.mentionAlerts}
                    onCheckedChange={(v) => setPreferences({ ...preferences, mentionAlerts: v })}
                  />
                </div>
                <Button onClick={savePreferences} className="w-full">
                  <Save className="mr-2 h-4 w-4" /> Save Preferences
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* System settings - super admin only */}
        {isSuperAdmin && canUpdateSettings && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <SettingsIcon className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">System Settings</CardTitle>
              </div>
              <CardDescription>Configure workflow behavior for all users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Default issue status</Label>
                  <Select
                    value={systemSettings.defaultIssueStatus}
                    onValueChange={(v) => setSystemSettings({ ...systemSettings, defaultIssueStatus: v as IssueStatus })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Status assigned to new issues by default</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Require approval for completion</Label>
                  <p className="text-xs text-muted-foreground">Completed issues must be approved before closure</p>
                </div>
                <Switch
                  checked={systemSettings.requireApprovalForCompletion}
                  onCheckedChange={(v) => setSystemSettings({ ...systemSettings, requireApprovalForCompletion: v })}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Allow self-assignment</Label>
                  <p className="text-xs text-muted-foreground">Users can assign issues to themselves</p>
                </div>
                <Switch
                  checked={systemSettings.allowSelfAssignment}
                  onCheckedChange={(v) => setSystemSettings({ ...systemSettings, allowSelfAssignment: v })}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Notify on assignment</Label>
                  <p className="text-xs text-muted-foreground">Send notification when an issue is assigned</p>
                </div>
                <Switch
                  checked={systemSettings.notifyOnAssignment}
                  onCheckedChange={(v) => setSystemSettings({ ...systemSettings, notifyOnAssignment: v })}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Notify on status change</Label>
                  <p className="text-xs text-muted-foreground">Send notification when issue status changes</p>
                </div>
                <Switch
                  checked={systemSettings.notifyOnStatusChange}
                  onCheckedChange={(v) => setSystemSettings({ ...systemSettings, notifyOnStatusChange: v })}
                />
              </div>
              <Button onClick={saveSystem} className="w-full">
                <Save className="mr-2 h-4 w-4" /> Save System Settings
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="lg:col-span-2">
          <PasswordCard />
        </div>
      </div>
    </div>
  );
}