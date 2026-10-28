import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useGetProfileStatsQuery, useUpdateProfileMutation } from '@/redux/features/auth/auth-api';
import { parseApiError } from '@/lib/api-error';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { UserAvatar } from '@/components/shared/user-avatar';
import { PasswordInput } from '@/components/auth/password-input';
import { Camera, Loader2, Pencil, Save, Trash2, Upload, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const AVATAR_PX = 512;

/** Center-crops the image to a square and scales it down before upload. */
function resizeImage(file: File, size: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Could not encode image'));
            return;
          }
          const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
          resolve(new File([blob], name, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Invalid image'));
    };
    img.src = url;
  });
}

type FormState = {
  name: string;
  email: string;
  /** Only asked for when the email changes */
  current_password: string;
  designation: string;
  department: string;
  phone: string;
  bio: string;
};

/** Backend field names that map onto form fields */
const FIELD_KEYS: readonly (keyof FormState | 'photo')[] = [
  'name', 'email', 'current_password', 'designation', 'department', 'phone', 'bio', 'photo',
];

export function ProfileCard() {
  const { session } = useAuth();
  const user = session!.user;
  const [updateProfile, { isLoading: saving }] = useUpdateProfileMutation();

  const initialForm = (): FormState => ({
    name: user.name,
    email: user.email,
    current_password: '',
    designation: user.title ?? '',
    department: user.department ?? '',
    phone: user.phone ?? '',
    bio: user.bio ?? '',
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Changing the email must be confirmed with the current password
  const emailChanged = form.email.trim().toLowerCase() !== user.email.toLowerCase();

  // Release the preview blob URL when it is replaced or the card unmounts
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  const setPhoto = (file: File | null) => {
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
    setErrors((e) => ({ ...e, photo: '' }));
  };

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
      setPhoto(await resizeImage(file, AVATAR_PX));
    } catch {
      toast.error('Could not read that image');
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const set = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const startEdit = () => {
    setForm(initialForm());
    setPhoto(null);
    setErrors({});
    setEditing(true);
  };

  const cancelEdit = () => {
    setPhoto(null);
    setEditing(false);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    else if (form.name.trim().length < 2) errs.name = 'Name must be at least 2 characters';

    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = 'Invalid email format';
    if (emailChanged && !form.current_password) errs.current_password = 'Enter your current password to change the email';

    if (form.phone.trim() && !/^[+\d][\d\s-]{5,}$/.test(form.phone.trim())) errs.phone = 'Invalid phone number';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    try {
      await updateProfile({
        name: form.name.trim(),
        email: form.email.trim(),
        current_password: emailChanged ? form.current_password : undefined,
        phone: form.phone.trim(),
        designation: form.designation.trim(),
        department: form.department.trim(),
        bio: form.bio.trim(),
        photo: photoFile ?? undefined,
      }).unwrap();
      setPhoto(null);
      setEditing(false);
      toast.success('Profile updated');
    } catch (err) {
      const apiError = parseApiError(err, 'Could not update profile');
      const fieldErrs: Record<string, string> = {};
      for (const key of FIELD_KEYS) {
        const message = apiError.fieldErrors[key]?.[0];
        if (message) fieldErrs[key] = message;
      }
      setErrors(fieldErrs);
      if (fieldErrs.photo) toast.error(fieldErrs.photo);
      else if (Object.keys(fieldErrs).length === 0) toast.error(apiError.message);
    }
  };

  const avatarImage = photoPreview ?? user.avatarUrl;

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
              disabled={saving}
              className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Upload profile photo"
              title="Click or drop an image"
            >
              <UserAvatar name={form.name || user.name} color={user.avatarColor} image={avatarImage} size="xl" />
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
                <Button type="button" variant="outline" size="sm" disabled={processing || saving} onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-3.5 w-3.5" />
                  {avatarImage ? 'Change photo' : 'Upload photo'}
                </Button>
                {photoFile && (
                  <Button type="button" variant="ghost" size="sm" disabled={saving} className="text-destructive hover:text-destructive" onClick={() => setPhoto(null)}>
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

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="pf-name" label="Full name" required value={form.name} error={errors.name} onChange={(v) => set('name', v)} />
              <Field id="pf-email" label="Email" required type="email" value={form.email} error={errors.email} onChange={(v) => set('email', v)} />
              {emailChanged && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="pf-current-password">
                    Current password <span className="text-destructive">*</span>
                  </Label>
                  <PasswordInput
                    id="pf-current-password"
                    autoComplete="current-password"
                    value={form.current_password}
                    disabled={saving}
                    onChange={(e) => set('current_password', e.target.value)}
                  />
                  {errors.current_password ? (
                    <p className="text-xs text-destructive">{errors.current_password}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Required to change your email address.</p>
                  )}
                </div>
              )}
              <Field id="pf-title" label="Designation" value={form.designation} error={errors.designation} placeholder="e.g. Support Engineer" onChange={(v) => set('designation', v)} />
              <Field id="pf-dept" label="Department" value={form.department} error={errors.department} placeholder="e.g. Operations" onChange={(v) => set('department', v)} />
              <Field id="pf-phone" label="Phone" value={form.phone} error={errors.phone} placeholder="01XXXXXXXXX" onChange={(v) => set('phone', v)} />
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
              <div className="flex justify-between gap-2">
                <p className="text-xs text-destructive">{errors.bio}</p>
                <p className="text-xs text-muted-foreground">{form.bio.length}/280</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled={saving} onClick={cancelEdit}>
                Cancel
              </Button>
              <Button className="flex-1" disabled={saving || processing} onClick={save}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Profile
              </Button>
            </div>
          </>
        ) : (
          <>
            <Separator />
            <ProfileStatsRow />
            <div className="grid grid-cols-2 gap-4">
              <ReadOnly label="Designation" value={user.title} />
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
  id, label, value, onChange, error, required, disabled, type = 'text', placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input id={id} type={type} value={value} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Done / active / on-time figures; left out entirely if the stats can't be loaded */
function ProfileStatsRow() {
  const { data, isLoading } = useGetProfileStatsQuery();
  if (!isLoading && !data) return null;

  const items = [
    { label: 'Done', value: data ? String(data.done) : '…' },
    { label: 'Active', value: data ? String(data.active) : '…' },
    { label: 'On time', value: data ? (data.on_time_rate === null ? '—' : `${Math.round(data.on_time_rate)}%`) : '…' },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border bg-muted/30 px-3 py-2 text-center">
          <div className="text-lg font-semibold leading-tight">{item.value}</div>
          <div className="text-xs text-muted-foreground">{item.label}</div>
        </div>
      ))}
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
