import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { applyFieldErrors, parseApiError } from '@/lib/api-error';
import { userFormSchema, type UserFormValues } from '@/lib/validations/user';
import { useGetRolesQuery } from '@/redux/features/roles/roles-api';
import type { ApiRole } from '@/redux/features/roles/roles-types';
import {
  useCreateUserMutation,
  useGetUserQuery,
  useUpdateUserMutation,
} from '@/redux/features/users/users-api';
import type { AdminUser } from '@/redux/features/users/users-types';

const FIELDS = ['name', 'email', 'designation', 'department', 'phone', 'default_role'] as const;
/** Radix radio items cannot use an empty value */
const NO_ROLE = '__none__';

const toNullable = (value: string) => value || null;

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null opens the dialog in create mode */
  user: AdminUser | null;
}

export function UserFormDialog({ open, onOpenChange, user }: UserFormDialogProps) {
  // Fetch the latest copy so the form never edits stale list data
  const { data: freshUser, isLoading: loadingUser } = useGetUserQuery(user?.id ?? 0, { skip: !open || !user });
  const { data: roles = [], isLoading: loadingRoles } = useGetRolesQuery(undefined, { skip: !open });

  const loading = loadingRoles || (Boolean(user) && loadingUser);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user ? 'Edit User' : 'Create New User'}</DialogTitle>
          <DialogDescription>
            {user
              ? 'Update user information and default role.'
              : 'Create a new user account. They will receive an invitation to set their password.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading...
          </div>
        ) : (
          <UserForm
            key={user?.id ?? 'new'}
            user={freshUser ?? user}
            roles={roles}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface UserFormProps {
  user: AdminUser | null;
  roles: ApiRole[];
  onDone: () => void;
}

function UserForm({ user, roles, onDone }: UserFormProps) {
  const [createUser, { isLoading: creating }] = useCreateUserMutation();
  const [updateUser, { isLoading: updating }] = useUpdateUserMutation();
  const saving = creating || updating;

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      designation: user?.designation ?? '',
      department: user?.department ?? '',
      phone: user?.phone ?? '',
      default_role: user?.default_role ?? '',
    },
  });

  const onSubmit = async (values: UserFormValues) => {
    const shared = {
      name: values.name,
      phone: toNullable(values.phone),
      designation: toNullable(values.designation),
      department: toNullable(values.department),
      default_role: toNullable(values.default_role),
    };
    try {
      if (user) {
        // Status is managed from the users table, so it is never sent from here
        await updateUser({ id: user.id, ...shared }).unwrap();
        toast.success('User updated', { description: `${values.name} has been updated successfully.` });
      } else {
        await createUser({ ...shared, email: values.email }).unwrap();
        toast.success('User created', { description: `${values.name} has been added and invited.` });
      }
      onDone();
    } catch (err) {
      const apiError = parseApiError(err, 'Failed to save user.');
      if (!applyFieldErrors(apiError, setError, FIELDS)) {
        setError('root', { message: apiError.message });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {errors.root?.message && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errors.root.message}
        </div>
      )}

      {/* Identity section */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Identity</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField id="name" label="Full name" required error={errors.name?.message}>
            <Input id="name" placeholder="John Smith" disabled={saving} {...register('name')} />
          </FormField>
          <FormField
            id="email"
            label="Email address"
            required
            error={errors.email?.message}
            hint={user ? 'Email cannot be changed.' : undefined}
          >
            <Input
              id="email"
              type="email"
              placeholder="john@techtrioz.com"
              disabled={saving || Boolean(user)}
              {...register('email')}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField id="designation" label="Job title" error={errors.designation?.message}>
            <Input id="designation" placeholder="Senior Developer" disabled={saving} {...register('designation')} />
          </FormField>
          <FormField id="department" label="Department" error={errors.department?.message}>
            <Input id="department" placeholder="Engineering" disabled={saving} {...register('department')} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField id="phone" label="Phone number" error={errors.phone?.message}>
            <Input id="phone" type="tel" placeholder="01712345678" disabled={saving} {...register('phone')} />
          </FormField>
        </div>
      </div>

      {/* Role assignment section */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Default Role</h3>
        <p className="text-xs text-muted-foreground">
          The role this user gets by default when added to a project.
        </p>
        <Controller
          control={control}
          name="default_role"
          render={({ field }) => (
            <div className="max-h-[260px] overflow-y-auto rounded-lg border">
              <RadioGroup
                value={field.value || NO_ROLE}
                onValueChange={(v) => field.onChange(v === NO_ROLE ? '' : v)}
                disabled={saving}
                className="gap-0 divide-y"
              >
                <RoleOption value={NO_ROLE} title="No default role" description="Assign a role per project instead." />
                {roles.map((role) => (
                  <RoleOption
                    key={role.id}
                    value={role.name}
                    title={role.name}
                    description={role.description || `${role.permissions.length} permissions`}
                    isSystem={role.is_system}
                  />
                ))}
              </RadioGroup>
            </div>
          )}
        />
        {errors.default_role && <p className="text-xs text-destructive">{errors.default_role.message}</p>}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {user ? 'Save changes' : 'Create user'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function FormField({
  id, label, required, error, hint, children,
}: { id: string; label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function RoleOption({
  value, title, description, isSystem,
}: { value: string; title: string; description: string; isSystem?: boolean }) {
  const id = `role-${value}`;
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 p-3 transition-colors hover:bg-accent">
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          {isSystem && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              System
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </label>
  );
}
