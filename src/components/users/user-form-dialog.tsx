import { useState, useEffect } from 'react';
import { userRepo, roleRepo, activityRepo } from '@/lib/repository';
import { useAuth } from '@/lib/auth-context';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { User, Role, UserStatus } from '@/lib/types';

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onSaved: () => void;
}

const AVATAR_COLORS = ['#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#ea580c'];

export function UserFormDialog({ open, onOpenChange, user, onSaved }: UserFormDialogProps) {
  const { session } = useAuth();
  const allRoles = roleRepo.all();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [status, setStatus] = useState<UserStatus>('active');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (user) {
        setName(user.name);
        setEmail(user.email);
        setPassword('');
        setTitle(user.title || '');
        setDepartment(user.department || '');
        setPhone(user.phone || '');
        setBio(user.bio || '');
        setSelectedRoleIds(user.roleIds);
        setStatus(user.status);
      } else {
        setName('');
        setEmail('');
        setPassword('');
        setTitle('');
        setDepartment('');
        setPhone('');
        setBio('');
        setSelectedRoleIds([]);
        setStatus('active');
      }
      setErrors({});
    }
  }, [open, user]);

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    else if (name.trim().length < 2) errs.name = 'Name must be at least 2 characters';

    if (!email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Invalid email format';

    const existing = userRepo.findByEmail(email.trim());
    if (existing && existing.id !== user?.id) errs.email = 'An account with this email already exists';

    if (!user && !password) errs.password = 'Password is required';
    else if (password && password.length < 6) errs.password = 'Password must be at least 6 characters';

    if (selectedRoleIds.length === 0) errs.roles = 'At least one role must be assigned';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !session) return;

    setSaving(true);
    try {
      if (user) {
        const patch: Partial<User> = {
          name: name.trim(),
          email: email.trim(),
          title: title.trim() || undefined,
          department: department.trim() || undefined,
          phone: phone.trim() || undefined,
          bio: bio.trim() || undefined,
          roleIds: selectedRoleIds,
          status,
        };
        if (password) patch.password = password;
        userRepo.update(user.id, patch);
        activityRepo.create({
          actorId: session.user.id,
          action: 'user_updated',
          entityType: 'User',
          entityId: user.id,
          entityName: name.trim(),
          summary: `Updated user "${name.trim()}"`,
        });
        toast.success('User updated', { description: `${name.trim()} has been updated successfully.` });
      } else {
        const newUser = userRepo.create({
          name: name.trim(),
          email: email.trim(),
          password,
          avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
          roleIds: selectedRoleIds,
          status,
          title: title.trim() || undefined,
          department: department.trim() || undefined,
          phone: phone.trim() || undefined,
          bio: bio.trim() || undefined,
        });
        activityRepo.create({
          actorId: session.user.id,
          action: 'user_created',
          entityType: 'User',
          entityId: newUser.id,
          entityName: newUser.name,
          summary: `Created user "${newUser.name}" with role(s): ${selectedRoleIds.map(rid => roleRepo.find(rid)?.name).filter(Boolean).join(', ')}`,
        });
        toast.success('User created', { description: `${name.trim()} has been added successfully.` });
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user ? 'Edit User' : 'Create New User'}</DialogTitle>
          <DialogDescription>
            {user
              ? 'Update user information, roles, and account status.'
              : 'Create a new user account and assign appropriate roles.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Identity section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Identity</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErrors({ ...errors, name: '' }); }}
                  placeholder="John Smith"
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address <span className="text-destructive">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors({ ...errors, email: '' }); }}
                  placeholder="john@techtrioz.com"
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="title">Job title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Senior Developer"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Engineering"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1-555-0100"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">
                  Password {user ? '(leave blank to keep current)' : <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors({ ...errors, password: '' }); }}
                  placeholder={user ? 'Unchanged' : 'Min. 6 characters'}
                />
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Brief description about this user..."
                rows={2}
              />
            </div>
          </div>

          {/* Role assignment section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Role Assignment</h3>
            <p className="text-xs text-muted-foreground">
              Select one or more roles for this user. Permissions from all assigned roles are combined.
            </p>
            <ScrollArea className="h-auto max-h-[200px] rounded-lg border">
              <div className="divide-y">
                {allRoles.map((role: Role) => (
                  <label
                    key={role.id}
                    className="flex cursor-pointer items-start gap-3 p-3 transition-colors hover:bg-accent"
                  >
                    <Checkbox
                      checked={selectedRoleIds.includes(role.id)}
                      onCheckedChange={() => toggleRole(role.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{role.name}</span>
                        {role.isSystem && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            System
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{role.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
            {errors.roles && <p className="text-xs text-destructive">{errors.roles}</p>}
          </div>

          {/* Status section */}
          {user && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Account Status</h3>
              <div className="flex gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="status"
                    checked={status === 'active'}
                    onChange={() => setStatus('active')}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Active</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="status"
                    checked={status === 'inactive'}
                    onChange={() => setStatus('inactive')}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Inactive</span>
                </label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {user ? 'Save changes' : 'Create user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
