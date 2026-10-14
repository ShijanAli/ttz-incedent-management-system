import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useLoginMutation } from '@/redux/features/auth/auth-api';
import { loginSchema, type LoginFormValues } from '@/lib/validations/auth';
import { parseApiError } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PasswordInput } from '@/components/auth/password-input';
import { toast } from 'sonner';
import loginBackground from '@/assets/images/login-background.jpg';

// Glassmorphism surfaces: light frost + saturation, a diagonal sheen and an inner top highlight
const glassDark =
  'border border-white/25 bg-gradient-to-br from-white/20 via-white/10 to-white/5 backdrop-blur-[6px] backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_32px_rgba(0,0,0,0.35)]';
const glassForm =
  'border border-white/30 bg-gradient-to-br from-white/20 via-white/10 to-white/5 backdrop-blur-[3px] backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_8px_32px_rgba(0,0,0,0.35)]';

export default function LoginPage() {
  const navigate = useNavigate();
  const { session, loading, mustChangePassword } = useAuth();
  const [login, { isLoading: submitting }] = useLoginMutation();

  const {
    register,
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: true },
  });

  // Also handles the redirect right after a successful login
  useEffect(() => {
    if (!loading && session) {
      navigate(mustChangePassword ? '/change-password' : '/dashboard', { replace: true });
    }
  }, [session, loading, mustChangePassword, navigate]);

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const data = await login(values).unwrap();
      if (data.must_change_password) {
        toast.info('Please set a new password', { description: 'You must change your password before continuing.' });
      } else {
        toast.success('Welcome back!', { description: 'You have been signed in successfully.' });
      }
    } catch (err) {
      // Wrong credentials come back as a 422 keyed on "email"; show them as one form-level message
      setError('root', { message: parseApiError(err, 'Login failed. Please try again.').message });
    }
  };

  const clearRootError = () => {
    if (errors.root) clearErrors('root');
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

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {errors.root?.message && (
              <div className="rounded-lg border border-destructive/30 bg-background/90 px-4 py-3 text-sm text-destructive">
                {errors.root.message}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@techtrioz.com"
                autoComplete="email"
                disabled={submitting}
                className="text-foreground"
                {...register('email', { onChange: clearRootError })}
              />
              {errors.email && <p className="text-xs text-red-300">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-white/90 underline-offset-2 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={submitting}
                className="text-foreground"
                {...register('password', { onChange: clearRootError })}
              />
              {errors.password && <p className="text-xs text-red-300">{errors.password.message}</p>}
            </div>

            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="remember"
                render={({ field }) => (
                  <Checkbox
                    id="remember"
                    checked={field.value}
                    onCheckedChange={(v) => field.onChange(v === true)}
                    disabled={submitting}
                  />
                )}
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
        </div>
      </div>
    </div>
  );
}
