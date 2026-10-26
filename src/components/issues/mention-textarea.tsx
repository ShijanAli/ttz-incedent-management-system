import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Textarea, type TextareaProps } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/shared/user-avatar';
import { findMentionQuery } from '@/lib/mentions';
import { getAvatarColor } from '@/lib/shared-utils';
import { cn } from '@/lib/utils';
import type { ProjectMember } from '@/redux/features/projects/projects-types';

const MAX_SUGGESTIONS = 8;

interface MentionTextareaProps extends Omit<TextareaProps, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  /** People who can be tagged (the project's members) */
  members: ProjectMember[];
  /** Left out of the list; tagging yourself does nothing */
  excludeUserId?: number;
  /** Called when someone is picked from the list */
  onMention?: (userId: number) => void;
}

/** A textarea that opens a member picker when the user types "@" */
export const MentionTextarea = forwardRef<HTMLTextAreaElement, MentionTextareaProps>(
  ({ value, onChange, members, excludeUserId, onMention, onKeyDown, onBlur, className, ...props }, ref) => {
    const inner = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement);

    const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
    const [active, setActive] = useState(0);

    const suggestions = useMemo(() => {
      if (!mention) return [];
      const q = mention.query.toLowerCase();
      const pool = members.filter((m) => m.user.id !== excludeUserId);
      // Matches from the start of a word ("app" → "Mobile App Developer") first, then anywhere
      const starts = pool.filter((m) =>
        m.user.name.toLowerCase().split(/\s+/).some((_, i, words) => words.slice(i).join(' ').startsWith(q)));
      const rest = pool.filter((m) => !starts.includes(m) && m.user.name.toLowerCase().includes(q));
      return [...starts, ...rest].slice(0, MAX_SUGGESTIONS);
    }, [mention, members, excludeUserId]);

    const open = !!mention && suggestions.length > 0;

    const syncMention = (el: HTMLTextAreaElement) => {
      const next = el.selectionStart === el.selectionEnd ? findMentionQuery(el.value, el.selectionStart) : null;
      if (next?.start === mention?.start && next?.query === mention?.query) return;
      setMention(next);
      setActive(0);
    };

    const pick = (member: ProjectMember) => {
      const el = inner.current;
      if (!mention || !el) return;
      const insert = `@${member.user.name} `;
      const caret = el.selectionStart;
      const next = value.slice(0, mention.start) + insert + value.slice(caret);
      onChange(next);
      onMention?.(member.user.id);
      setMention(null);
      const pos = mention.start + insert.length;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (open) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const step = e.key === 'ArrowDown' ? 1 : -1;
          setActive((i) => (i + step + suggestions.length) % suggestions.length);
          return;
        }
        if ((e.key === 'Enter' && !e.metaKey && !e.ctrlKey) || e.key === 'Tab') {
          e.preventDefault();
          pick(suggestions[Math.min(active, suggestions.length - 1)]);
          return;
        }
        if (e.key === 'Escape') {
          // Close the picker without cancelling an edit
          e.preventDefault();
          e.stopPropagation();
          setMention(null);
          return;
        }
      }
      onKeyDown?.(e);
    };

    return (
      <div className="relative w-full">
        <Textarea
          ref={inner}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            syncMention(e.target);
          }}
          onSelect={(e) => syncMention(e.currentTarget)}
          onKeyDown={handleKeyDown}
          onBlur={(e) => {
            setMention(null);
            onBlur?.(e);
          }}
          className={className}
          aria-autocomplete="list"
          aria-expanded={open}
          {...props}
        />
        {open && (
          <div
            role="listbox"
            className="absolute bottom-full left-0 z-50 mb-1 max-h-60 w-64 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          >
            {suggestions.map((m, i) => (
              <button
                key={m.user.id}
                type="button"
                role="option"
                aria-selected={i === active}
                // Keep focus in the textarea so the caret position survives
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(m)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                  i === active && 'bg-accent text-accent-foreground',
                )}
              >
                <UserAvatar name={m.user.name} color={getAvatarColor(m.user.id)} image={m.user.photo_url ?? undefined} size="xs" />
                <span className="min-w-0 flex-1 truncate">{m.user.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{m.role}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
);
MentionTextarea.displayName = 'MentionTextarea';
