import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { userRepo, activityRepo } from '@/lib/repository';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { KeyRound, Lock } from 'lucide-react';
import { toast } from 'sonner';

export function PasswordCard() {
  const { session } = useAuth();
  const user = session!.user;

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    // Read the stored user, not the session copy, in case it changed elsewhere
    const stored = userRepo.find(user.id);
    if (!current) errs.current = 'Enter your current password';
    else if (stored?.password !== current) errs.current = 'Current password is incorrect';
    if (!next) errs.next = 'Enter a new password';
    else if (next.length < 6) errs.next = 'Password must be at least 6 characters';
    else if (next === current) errs.next = 'New password must be different from the current one';
    if (confirm !== next) errs.confirm = 'Passwords do not match';

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    userRepo.update(user.id, { password: next });
    activityRepo.create({
      actorId: user.id,
      action: 'user_updated',
      entityType: 'User',
      entityId: user.id,
      entityName: user.name,
      summary: 'Changed own password',
    });
    setCurrent('');
    setNext('');
    setConfirm('');
    toast.success('Password changed');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Security</CardTitle>
        </div>
        <CardDescription>
          Change your sign-in password. This is a demo app, so data is stored locally in your browser.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
          <PasswordField id="pw-current" label="Current password" value={current} error={errors.current}
            autoComplete="current-password" onChange={(v) => { setCurrent(v); setErrors((e) => ({ ...e, current: '' })); }} />
          <PasswordField id="pw-new" label="New password" value={next} error={errors.next}
            autoComplete="new-password" onChange={(v) => { setNext(v); setErrors((e) => ({ ...e, next: '' })); }} />
          <PasswordField id="pw-confirm" label="Confirm new password" value={confirm} error={errors.confirm}
            autoComplete="new-password" onChange={(v) => { setConfirm(v); setErrors((e) => ({ ...e, confirm: '' })); }} />
          <div className="sm:col-span-3 sm:flex sm:justify-end">
            <Button type="submit" className="w-full sm:w-auto">
              <KeyRound className="mr-2 h-4 w-4" /> Update Password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordField({
  id, label, value, onChange, error, autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="password" value={value} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
