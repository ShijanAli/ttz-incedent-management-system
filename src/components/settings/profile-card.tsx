import { useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { userRepo, activityRepo } from '@/lib/repository';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { UserAvatar } from '@/components/shared/user-avatar';
import { Camera, Check, Loader2, Pencil, Save, Trash2, Upload, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const AVATAR_COLORS = ['#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#475569'];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const AVATAR_PX = 256;

/**
 * Center-crops the image to a square and scales it down, so the stored
 * data URL stays small enough for localStorage (~15–30 KB).
 */
function resizeImage(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas not supported'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Invalid image'));
    };
    img.src = url;
  });
}

export function ProfileCard() {
  const { session, refreshSession } = useAuth();
  const user = session!.user;

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    title: user.title ?? '',
    department: user.department ?? '',
    phone: user.phone ?? '',
    bio: user.bio ?? '',
    avatarColor: user.avatarColor,
    avatarUrl: user.avatarUrl ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('Image is too large', { description: 'Maximum size is 5 MB.' });
      return;
    }
    setProcessing(true);
    try {
      set('avatarUrl', await resizeImage(file, AVATAR_PX));
    } catch {
      toast.error('Could not read that image');
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const startEdit = () => {
    setForm({
      name: user.name,
      email: user.email,
      title: user.title ?? '',
      department: user.department ?? '',
      phone: user.phone ?? '',
      bio: user.bio ?? '',
      avatarColor: user.avatarColor,
      avatarUrl: user.avatarUrl ?? '',
    });
    setErrors({});
    setEditing(true);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    else if (form.name.trim().length < 2) errs.name = 'Name must be at least 2 characters';

    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = 'Invalid email format';
    else {
      const existing = userRepo.findByEmail(form.email.trim());
      if (existing && existing.id !== user.id) errs.email = 'An account with this email already exists';
    }

    if (form.phone.trim() && !/^[+\d][\d\s-]{5,}$/.test(form.phone.trim())) errs.phone = 'Invalid phone number';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const save = () => {
    if (!validate()) return;
    userRepo.update(user.id, {
      name: form.name.trim(),
      email: form.email.trim(),
      title: form.title.trim() || undefined,
      department: form.department.trim() || undefined,
      phone: form.phone.trim() || undefined,
      bio: form.bio.trim() || undefined,
      avatarColor: form.avatarColor,
      avatarUrl: form.avatarUrl || undefined,
    });
    activityRepo.create({
      actorId: user.id,
      action: 'user_updated',
      entityType: 'User',
      entityId: user.id,
      entityName: form.name.trim(),
      summary: `Updated own profile`,
    });
    refreshSession();
    setEditing(false);
    toast.success('Profile updated');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Profile</CardTitle>
          </div>
          <CardDescription>Your account information</CardDescription>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          {editing ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
              className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Upload profile photo"
              title="Click or drop an image"
            >
              <UserAvatar name={form.name || user.name} color={form.avatarColor} image={form.avatarUrl || undefined} size="xl" />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
                {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
              </span>
            </button>
          ) : (
            <UserAvatar name={user.name} color={user.avatarColor} image={user.avatarUrl} size="xl" />
          )}
          <div className="min-w-0 space-y-2">
            <div>
              <div className="truncate text-sm font-medium">{editing ? form.name || '—' : user.name}</div>
              <div className="truncate text-xs text-muted-foreground">{editing ? form.email || '—' : user.email}</div>
            </div>
            {editing && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={processing} onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-3.5 w-3.5" />
                  {form.avatarUrl ? 'Change photo' : 'Upload photo'}
                </Button>
                {form.avatarUrl && (
                  <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => set('avatarUrl', '')}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove
                  </Button>
                )}
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>

        {editing ? (
          <>
            <p className="text-xs text-muted-foreground">
              JPG, PNG, WebP or GIF up to 5 MB. Cropped to a square automatically.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Avatar color {form.avatarUrl && <span className="font-normal text-muted-foreground">(used when no photo is set)</span>}
              </Label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => set('avatarColor', color)}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow',
                      form.avatarColor === color && 'ring-2 ring-foreground'
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Use color ${color}`}
                  >
                    {form.avatarColor === color && <Check className="h-3.5 w-3.5 text-white" />}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="pf-name" label="Full name" required value={form.name} error={errors.name} onChange={(v) => set('name', v)} />
              <Field id="pf-email" label="Email" required type="email" value={form.email} error={errors.email} onChange={(v) => set('email', v)} />
              <Field id="pf-title" label="Title" value={form.title} placeholder="e.g. Support Engineer" onChange={(v) => set('title', v)} />
              <Field id="pf-dept" label="Department" value={form.department} placeholder="e.g. Operations" onChange={(v) => set('department', v)} />
              <Field id="pf-phone" label="Phone" value={form.phone} error={errors.phone} placeholder="+880 1XXX-XXXXXX" onChange={(v) => set('phone', v)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pf-bio">Bio</Label>
              <Textarea
                id="pf-bio"
                rows={3}
                value={form.bio}
                maxLength={280}
                placeholder="A short line about you..."
                onChange={(e) => set('bio', e.target.value)}
              />
              <p className="text-right text-xs text-muted-foreground">{form.bio.length}/280</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={save}>
                <Save className="mr-2 h-4 w-4" /> Save Profile
              </Button>
            </div>
          </>
        ) : (
          <>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <ReadOnly label="Title" value={user.title} />
              <ReadOnly label="Department" value={user.department} />
              <ReadOnly label="Phone" value={user.phone} />
              <div>
                <Label className="text-xs text-muted-foreground">Roles</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {session!.roleNames.map((r) => (
                    <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
                  ))}
                </div>
              </div>
            </div>
            {user.bio && (
              <div>
                <Label className="text-xs text-muted-foreground">Bio</Label>
                <p className="text-sm">{user.bio}</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Field({
  id, label, value, onChange, error, required, type = 'text', placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="text-sm">{value || '—'}</p>
    </div>
  );
}
