import { useState } from 'react';
import { Check, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { parseApiError } from '@/lib/api-error';
import { useAuth } from '@/lib/auth-context';
import {
  useCreateIssueCategoryMutation,
  useGetIssueCategoriesQuery,
} from '@/redux/features/issue-categories/issue-categories-api';
import { ColorSwatchPicker, SWATCH_COLORS } from '@/components/shared/color-swatch-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue,
} from '@/components/ui/select';

/** "UI Problem" → "ui-problem" */
const toSlug = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

interface IssueCategorySelectProps {
  id?: string;
  /** Category id as a string ("" for none) */
  value: string;
  onChange: (categoryId: string) => void;
  disabled?: boolean;
}

/**
 * Category picker for the issue form, backed by GET /issue-categories (or the admin
 * list for super admins). Super admins also get an "Add custom category" button that
 * opens a small inline form; the new category is selected as soon as it is created.
 */
export function IssueCategorySelect({ id, value, onChange, disabled }: IssueCategorySelectProps) {
  // Categories are managed through the admin API, so only super admins can add one
  const { isSuperAdmin } = useAuth();
  const { data: categories = [], isLoading, isError, error, refetch } = useGetIssueCategoriesQuery({ admin: isSuperAdmin });
  const [createCategory, { isLoading: creating }] = useCreateIssueCategoryMutation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(SWATCH_COLORS[3]);
  const [nameError, setNameError] = useState('');

  // Inactive categories can't be picked for new work, but the current one stays visible
  const options = categories.filter((c) => c.is_active || String(c.id) === value);

  const openAddForm = () => {
    setMenuOpen(false);
    setAdding(true);
    setName('');
    setColor(SWATCH_COLORS[3]);
    setNameError('');
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Name is required');
      return;
    }
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setNameError('A category with this name already exists');
      return;
    }
    try {
      const created = await createCategory({ name: trimmed, slug: toSlug(trimmed), color, is_active: true }).unwrap();
      toast.success('Category added', { description: `"${created.name}" is ready to use.` });
      onChange(String(created.id));
      setAdding(false);
    } catch (err) {
      const apiError = parseApiError(err, 'Failed to add category');
      setNameError(apiError.fieldErrors.name?.[0] ?? apiError.fieldErrors.slug?.[0] ?? '');
      toast.error('Failed to add category', { description: apiError.message });
    }
  };

  return (
    <div className="space-y-2">
      <Select open={menuOpen} onOpenChange={setMenuOpen} value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="gap-2 [&>span]:min-w-0">
          <SelectValue placeholder={isLoading ? 'Loading categories...' : 'Select category'} />
        </SelectTrigger>
        <SelectContent>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading categories...
            </div>
          ) : isError ? (
            <div className="space-y-2 px-2 py-3 text-center text-xs">
              <p className="text-destructive">{parseApiError(error, 'Failed to load categories.').message}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          ) : options.length === 0 ? (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">No categories yet.</div>
          ) : (
            options.map((c) => (
              <SelectItem key={c.id} value={String(c.id)} title={c.name}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="truncate">{c.name}</span>
                </span>
              </SelectItem>
            ))
          )}
          {isSuperAdmin && (
            <>
              <SelectSeparator />
              <button
                type="button"
                onClick={openAddForm}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-medium text-primary outline-none hover:bg-accent focus-visible:bg-accent"
              >
                <Plus className="h-4 w-4" /> Add custom category
              </button>
            </>
          )}
        </SelectContent>
      </Select>

      {isSuperAdmin && adding && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(''); }}
              onKeyDown={(e) => {
                // Enter would submit the whole issue form
                if (e.key === 'Enter') { e.preventDefault(); void handleCreate(); }
                if (e.key === 'Escape') { e.preventDefault(); setAdding(false); }
              }}
              placeholder="Category name, e.g. Security"
              maxLength={100}
              disabled={creating}
              autoFocus
              aria-label="New category name"
            />
            <Button type="button" size="icon" onClick={handleCreate} disabled={creating} aria-label="Save category">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => setAdding(false)}
              disabled={creating}
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          <ColorSwatchPicker value={color} onChange={setColor} disabled={creating} />
        </div>
      )}
    </div>
  );
}
