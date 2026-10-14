import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ShieldCheck, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChangePasswordForm } from '@/components/auth/change-password-form';

/** Shown after login when the backend flags `must_change_password` (e.g. an admin-issued temporary password). */
export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { session, loading, mustChangePassword, logout } = useAuth();

  useEffect(() => {
    if (!loading && !session) navigate('/login', { replace: true });
  }, [session, loading, navigate]);

  if (loading || !session) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">Techtrioz IMS</span>
        </div>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <h1 className="text-lg font-semibold">
                {mustChangePassword ? 'Set a new password' : 'Change password'}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mustChangePassword
                  ? `Hi ${session.user.name}, you need to replace your temporary password before continuing.`
                  : 'Update the password you use to sign in.'}
              </p>
            </div>

            <ChangePasswordForm
              submitLabel="Save new password"
              onSuccess={() => navigate('/dashboard', { replace: true })}
            />

            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
