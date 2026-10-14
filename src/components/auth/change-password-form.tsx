import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/auth/password-input';
import { useChangePasswordMutation } from '@/redux/features/auth/auth-api';
import { changePasswordSchema, type ChangePasswordFormValues } from '@/lib/validations/auth';
import { applyFieldErrors, parseApiError } from '@/lib/api-error';
import { cn } from '@/lib/utils';

const FIELDS = ['current_password', 'password', 'password_confirmation'] as const;

interface ChangePasswordFormProps {
  /** "inline" puts the three fields in a row on wide screens (settings card) */
  layout?: 'inline' | 'stacked';
  submitLabel?: string;
  onSuccess?: () => void;
}

export function ChangePasswordForm({ layout = 'stacked', submitLabel = 'Update Password', onSuccess }: ChangePasswordFormProps) {
  const [changePassword, { isLoading }] = useChangePasswordMutation();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current_password: '', password: '', password_confirmation: '' },
  });

  const onSubmit = async (values: ChangePasswordFormValues) => {
    try {
      const res = await changePassword(values).unwrap();
      reset();
      toast.success(res.message || 'Password changed successfully.');
      onSuccess?.();
    } catch (err) {
      const apiError = parseApiError(err, 'Could not change your password.');
      if (!applyFieldErrors(apiError, setError, FIELDS)) {
        setError('root', { message: apiError.message });
      }
    }
  };

  const inline = layout === 'inline';

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className={cn('grid gap-4', inline && 'sm:grid-cols-3')}>
      {errors.root?.message && (
        <div className={cn('rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive', inline && 'sm:col-span-3')}>
          {errors.root.message}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="cp-current">Current password</Label>
        <PasswordInput id="cp-current" autoComplete="current-password" disabled={isLoading} {...register('current_password')} />
        {errors.current_password && <p className="text-xs text-destructive">{errors.current_password.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cp-new">New password</Label>
        <PasswordInput id="cp-new" autoComplete="new-password" disabled={isLoading} {...register('password')} />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cp-confirm">Confirm new password</Label>
        <PasswordInput id="cp-confirm" autoComplete="new-password" disabled={isLoading} {...register('password_confirmation')} />
        {errors.password_confirmation && <p className="text-xs text-destructive">{errors.password_confirmation.message}</p>}
      </div>

      <p className={cn('text-xs text-muted-foreground', inline && 'sm:col-span-3')}>
        At least 8 characters, with an uppercase letter, a lowercase letter and a number.
      </p>

      <div className={cn(inline && 'sm:col-span-3 sm:flex sm:justify-end')}>
        <Button type="submit" className={cn('w-full', inline && 'sm:w-auto')} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
