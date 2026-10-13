import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { ShieldCheck, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DEMO_CREDENTIALS } from '@/lib/seed-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import loginBackground from '@/assets/images/login-background.jpg';

// Glassmorphism surfaces: light frost + saturation, a diagonal sheen and an inner top highlight
const glassDark =
  'border border-white/25 bg-gradient-to-br from-white/20 via-white/10 to-white/5 backdrop-blur-[6px] backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_32px_rgba(0,0,0,0.35)]';
const glassForm =
  'border border-white/30 bg-gradient-to-br from-white/20 via-white/10 to-white/5 backdrop-blur-[3px] backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_8px_32px_rgba(0,0,0,0.35)]';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, session, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && session) {
      navigate('/dashboard', { replace: true });
    }
  }, [session, loading, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }

    setSubmitting(true);
    const result = login(email.trim(), password);
    setSubmitting(false);

    if (result.success) {
      toast.success('Welcome back!', { description: 'You have been signed in successfully.' });
      navigate('/dashboard', { replace: true });
    } else {
      setError(result.error || 'Login failed.');
    }
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('demo123');
    setError('');
  };

  return (
    <div
      className="relative flex min-h-screen flex-col bg-cover bg-center lg:flex-row"
      style={{ backgroundImage: `url(${loginBackground})` }}
    >
      {/* Dim overlay so the photo shows through at reduced opacity */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Left panel */}
      <div className="relative hidden flex-col justify-between p-10 text-white lg:flex lg:w-1/2">
        <div className={`flex w-fit items-center gap-3 rounded-2xl px-4 py-3 ${glassDark}`}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="text-lg font-bold">Techtrioz IMS</div>
            <div className="text-xs text-white/60">Incident Management System</div>
          </div>
        </div>
        <div className={`max-w-lg space-y-4 rounded-2xl p-6 ${glassDark}`}>
          <h2 className="text-3xl font-bold leading-tight">
            Enterprise incident management,<br />streamlined.
          </h2>
          <p className="text-white/80 max-w-md">
            Manage projects, track incidents, assign issues, control access with dynamic RBAC,
            and monitor team performance — all in one platform.
          </p>
        </div>
        <div className={`w-fit rounded-full px-4 py-2 text-xs text-white/80 ${glassDark}`}>
          Techtrioz Solutions — Internal Platform
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="relative flex flex-1 items-center justify-center p-6 lg:p-10">
        <div className={`w-full max-w-2xl space-y-5 rounded-2xl p-6 text-white sm:p-8 ${glassForm}`}>
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold">Techtrioz IMS</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
            <p className="mt-1 text-sm text-white/80">
              Enter your credentials to access your dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-background/90 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@techtrioz.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                autoComplete="email"
                disabled={submitting}
                className="text-foreground"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-white/90 underline-offset-2 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  autoComplete="current-password"
                  disabled={submitting}
                  className="pr-10 text-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={remember}
                onCheckedChange={(v) => setRemember(v === true)}
              />
              <Label htmlFor="remember" className="text-sm text-white/80 cursor-pointer">
                Keep me signed in
              </Label>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          {/* Demo credentials */}
          <div className="rounded-lg border border-white/25 bg-white/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
            <div className="mb-2 text-xs font-semibold text-white/80 uppercase tracking-wide">
              Demo Accounts (click to fill)
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              {DEMO_CREDENTIALS.map((cred) => (
                <button
                  key={cred.email}
                  onClick={() => fillDemo(cred.email)}
                  title={cred.email}
                  className="flex min-w-0 flex-col rounded-md border bg-background/80 text-foreground px-3 py-2 text-left text-xs transition-colors hover:border-primary hover:bg-accent"
                >
                  <span className="truncate font-medium">{cred.role}</span>
                  <span className="truncate text-muted-foreground">{cred.email}</span>
                </button>
              ))}
            </div>
            <div className="mt-2 text-xs text-white/80">
              Password for all demo accounts: <span className="font-mono font-medium">demo123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
