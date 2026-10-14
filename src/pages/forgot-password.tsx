import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck, ArrowLeft, Mail, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { PasswordInput } from '@/components/auth/password-input';
import {
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useVerifyForgotOtpMutation,
} from '@/redux/features/auth/auth-api';
import {
  OTP_LENGTH,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyOtpSchema,
  type ForgotPasswordFormValues,
  type ResetPasswordFormValues,
  type VerifyOtpFormValues,
} from '@/lib/validations/auth';
import { applyFieldErrors, parseApiError } from '@/lib/api-error';

type Step = 'email' | 'otp' | 'reset' | 'done';

const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState<string | undefined>();

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
          <CardContent className="pt-6">
            {step === 'email' && (
              <EmailStep
                defaultEmail={email}
                onSent={(sentTo) => {
                  setEmail(sentTo);
                  setStep('otp');
                }}
              />
            )}
            {step === 'otp' && (
              <OtpStep
                email={email}
                onBack={() => setStep('email')}
                onVerified={(code, token) => {
                  setOtp(code);
                  setResetToken(token);
                  setStep('reset');
                }}
              />
            )}
            {step === 'reset' && (
              <ResetStep
                email={email}
                otp={otp}
                token={resetToken}
                onExpired={() => setStep('otp')}
                onDone={() => setStep('done')}
              />
            )}
            {step === 'done' && <DoneStep />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StepHeader({ title, description }: { title: string; description: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}

function BackToLogin() {
  return (
    <Link to="/login" className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" />
      Back to sign in
    </Link>
  );
}

// ---- Step 1: request a code ----

function EmailStep({ defaultEmail, onSent }: { defaultEmail: string; onSent: (email: string) => void }) {
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: defaultEmail },
  });

  const onSubmit = async ({ email }: ForgotPasswordFormValues) => {
    try {
      const res = await forgotPassword({ email }).unwrap();
      toast.success(res.message || 'Verification code sent.');
      onSent(email);
    } catch (err) {
      const apiError = parseApiError(err, 'Could not send the verification code.');
      if (!applyFieldErrors(apiError, setError, ['email'] as const)) {
        setError('root', { message: apiError.message });
      }
    }
  };

  return (
    <div className="space-y-4">
      <StepHeader
        title="Reset your password"
        description={`Enter your email address and we'll send you a ${OTP_LENGTH}-digit verification code.`}
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormError message={errors.root?.message} />
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="you@techtrioz.com"
              autoComplete="email"
              className="pl-9"
              disabled={isLoading}
              {...register('email')}
            />
          </div>
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending code...
            </>
          ) : (
            'Send verification code'
          )}
        </Button>
      </form>

      <BackToLogin />
    </div>
  );
}

// ---- Step 2: verify the code ----

function OtpStep({
  email,
  onBack,
  onVerified,
}: {
  email: string;
  onBack: () => void;
  onVerified: (otp: string, token?: string) => void;
}) {
  const [verifyOtp, { isLoading }] = useVerifyForgotOtpMutation();
  const [resend, { isLoading: resending }] = useForgotPasswordMutation();
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<VerifyOtpFormValues>({
    resolver: zodResolver(verifyOtpSchema),
    defaultValues: { otp: '' },
  });

  const onSubmit = async ({ otp }: VerifyOtpFormValues) => {
    try {
      const res = await verifyOtp({ email, otp }).unwrap();
      onVerified(otp, res.data?.token ?? res.data?.reset_token);
    } catch (err) {
      const apiError = parseApiError(err, 'Could not verify the code.');
      if (!applyFieldErrors(apiError, setError, ['otp'] as const)) {
        setError('otp', { message: apiError.message });
      }
    }
  };

  const handleResend = async () => {
    try {
      const res = await resend({ email }).unwrap();
      toast.success(res.message || 'A new code has been sent.');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      toast.error(parseApiError(err, 'Could not resend the code.').message);
    }
  };

  return (
    <div className="space-y-4">
      <StepHeader
        title="Enter verification code"
        description={
          <>
            We sent a {OTP_LENGTH}-digit code to <span className="font-medium text-foreground">{email}</span>.
          </>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="flex flex-col items-center gap-2">
          <Controller
            control={control}
            name="otp"
            render={({ field }) => (
              <InputOTP
                maxLength={OTP_LENGTH}
                value={field.value}
                onChange={(v) => field.onChange(v.replace(/\D/g, ''))}
                onComplete={() => handleSubmit(onSubmit)()}
                inputMode="numeric"
                autoFocus
                disabled={isLoading}
              >
                <InputOTPGroup>
                  {Array.from({ length: OTP_LENGTH }, (_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            )}
          />
          {errors.otp && <p className="text-xs text-destructive">{errors.otp.message}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            'Verify code'
          )}
        </Button>
      </form>

      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground">
          Change email
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || resending}
          className="font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
        >
          {resending ? 'Sending...' : cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </div>
  );
}

// ---- Step 3: choose a new password ----

function ResetStep({
  email,
  otp,
  token,
  onExpired,
  onDone,
}: {
  email: string;
  otp: string;
  token?: string;
  onExpired: () => void;
  onDone: () => void;
}) {
  const [resetPassword, { isLoading }] = useResetPasswordMutation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', password_confirmation: '' },
  });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    try {
      const res = await resetPassword({ email, otp, token, ...values }).unwrap();
      toast.success(res.message || 'Your password has been reset.');
      onDone();
    } catch (err) {
      const apiError = parseApiError(err, 'Could not reset your password.');
      if (apiError.code === 'INVALID_OTP') {
        toast.error(apiError.message, { description: 'Please request or enter a new code.' });
        onExpired();
        return;
      }
      if (!applyFieldErrors(apiError, setError, ['password', 'password_confirmation'] as const)) {
        setError('root', { message: apiError.message });
      }
    }
  };

  return (
    <div className="space-y-4">
      <StepHeader title="Set a new password" description={`Choose a new password for ${email}.`} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormError message={errors.root?.message} />

        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <PasswordInput id="new-password" autoComplete="new-password" autoFocus disabled={isLoading} {...register('password')} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <PasswordInput id="confirm-password" autoComplete="new-password" disabled={isLoading} {...register('password_confirmation')} />
          {errors.password_confirmation && (
            <p className="text-xs text-destructive">{errors.password_confirmation.message}</p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          At least 8 characters, with an uppercase letter, a lowercase letter and a number.
        </p>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Resetting password...
            </>
          ) : (
            'Reset password'
          )}
        </Button>
      </form>

      <BackToLogin />
    </div>
  );
}

// ---- Done ----

function DoneStep() {
  const navigate = useNavigate();
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
      </div>
      <StepHeader title="Password updated" description="You can now sign in with your new password." />
      <Button className="w-full" onClick={() => navigate('/login', { replace: true })}>
        Back to sign in
      </Button>
    </div>
  );
}
