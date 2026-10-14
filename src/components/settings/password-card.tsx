import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChangePasswordForm } from '@/components/auth/change-password-form';
import { Lock } from 'lucide-react';

export function PasswordCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Security</CardTitle>
        </div>
        <CardDescription>Change your sign-in password.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChangePasswordForm layout="inline" />
      </CardContent>
    </Card>
  );
}
