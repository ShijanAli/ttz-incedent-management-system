import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { parseApiError } from '@/lib/api-error';
import { useCreateCustomerMutation, useUpdateCustomerMutation } from '@/redux/features/customers/customers-api';
import type { Customer } from '@/redux/features/customers/customers-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null opens the dialog in create mode */
  customer: Customer | null;
}

type Fields = { name: string; code: string; contact_email: string; contact_phone: string; is_active: boolean };
type FieldErrors = Partial<Record<keyof Fields, string>>;

const EMPTY: Fields = { name: '', code: '', contact_email: '', contact_phone: '', is_active: true };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toFields = (c: Customer): Fields => ({
  name: c.name,
  code: c.code ?? '',
  contact_email: c.contact_email ?? '',
  contact_phone: c.contact_phone ?? '',
  is_active: c.is_active,
});

/** Create or edit a customer (POST / PATCH /admin/customers) */
export function CustomerFormDialog({ open, onOpenChange, customer }: CustomerFormDialogProps) {
  const isEdit = Boolean(customer);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [createCustomer, { isLoading: creating }] = useCreateCustomerMutation();
  const [updateCustomer, { isLoading: updating }] = useUpdateCustomerMutation();
  const saving = creating || updating;

  useEffect(() => {
    if (open) {
      setFields(customer ? toFields(customer) : EMPTY);
      setErrors({});
    }
  }, [open, customer]);

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    setFields((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const errs: FieldErrors = {};
    if (!fields.name.trim()) errs.name = 'Name is required';
    if (fields.contact_email.trim() && !EMAIL_RE.test(fields.contact_email.trim())) errs.contact_email = 'Enter a valid email';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    // Empty optional fields go as null so an edit can clear them
    const body = {
      name: fields.name.trim(),
      code: fields.code.trim() || null,
      contact_email: fields.contact_email.trim() || null,
      contact_phone: fields.contact_phone.trim() || null,
      is_active: fields.is_active,
    };
    try {
      if (customer) {
        // PATCH takes only what changed
        const before = toFields(customer);
        const changed = Object.fromEntries(
          Object.entries(body).filter(([k, v]) => (v ?? '') !== before[k as keyof Fields]),
        );
        if (Object.keys(changed).length > 0) await updateCustomer({ id: customer.id, ...changed }).unwrap();
        toast.success('Customer updated');
      } else {
        await createCustomer(body).unwrap();
        toast.success('Customer added', { description: body.name });
      }
      onOpenChange(false);
    } catch (err) {
      const apiError = parseApiError(err, isEdit ? 'Failed to update customer' : 'Failed to add customer');
      const fieldErrors: FieldErrors = {};
      for (const [field, messages] of Object.entries(apiError.fieldErrors)) {
        if (field in EMPTY && messages[0]) fieldErrors[field as keyof Fields] = messages[0];
      }
      setErrors(fieldErrors);
      toast.error(isEdit ? 'Failed to update customer' : 'Failed to add customer', { description: apiError.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${customer?.name}` : 'Add customer'}</DialogTitle>
          <DialogDescription>Customers can be picked when an issue comes from a customer complaint.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Field id="customerName" label="Name" required error={errors.name}>
            <Input id="customerName" value={fields.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Acme Logistics" autoFocus disabled={saving} />
          </Field>
          <Field id="customerCode" label="Code" hint="Optional, must be unique" error={errors.code}>
            <Input
              id="customerCode"
              value={fields.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              placeholder="e.g. ACME"
              className="font-mono"
              disabled={saving}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="customerEmail" label="Contact email" error={errors.contact_email}>
              <Input id="customerEmail" type="email" value={fields.contact_email} onChange={(e) => set('contact_email', e.target.value)} placeholder="support@acme.com" disabled={saving} />
            </Field>
            <Field id="customerPhone" label="Contact phone" error={errors.contact_phone}>
              <Input id="customerPhone" type="tel" value={fields.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} placeholder="01700000000" disabled={saving} />
            </Field>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="customerActive" className="text-sm">Active</Label>
              <p className="text-xs text-muted-foreground">Inactive customers can&apos;t be picked for new complaints</p>
            </div>
            <Switch id="customerActive" checked={fields.is_active} onCheckedChange={(v) => set('is_active', v)} disabled={saving} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Save changes' : 'Add customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ id, label, required, hint, error, children }: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} {required && <span className="text-destructive">*</span>}
        {hint && <span className="ml-1 text-xs font-normal text-muted-foreground">({hint})</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
