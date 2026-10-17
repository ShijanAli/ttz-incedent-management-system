import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Quick picks shared by every "choose a color" control (categories, statuses) */
export const SWATCH_COLORS = ['#DC2626', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#FF8B00', '#64748B'];

interface ColorSwatchPickerProps {
  /** #RRGGBB */
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

/** Preset swatches plus a native picker for any other color; values are uppercase #RRGGBB */
export function ColorSwatchPicker({ value, onChange, disabled }: ColorSwatchPickerProps) {
  const selected = value.toLowerCase();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {SWATCH_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          disabled={disabled}
          className={cn(
            'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 disabled:pointer-events-none',
            selected === c.toLowerCase() ? 'border-foreground' : 'border-transparent',
          )}
          style={{ backgroundColor: c }}
          aria-label={`Color ${c}`}
          aria-pressed={selected === c.toLowerCase()}
        />
      ))}
      <label className="relative ml-1 flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-full border" title="Custom color">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          disabled={disabled}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Custom color"
        />
        <Plus className="h-3 w-3 text-muted-foreground" />
      </label>
      <span className="ml-1 font-mono text-xs text-muted-foreground">{value}</span>
    </div>
  );
}
