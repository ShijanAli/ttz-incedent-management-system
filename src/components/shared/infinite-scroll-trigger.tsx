import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InfiniteScrollTriggerProps {
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  /** Pauses loading, e.g. while the list is in its initial load or showing an error */
  disabled?: boolean;
  /** Start loading this far before the trigger scrolls into view */
  rootMargin?: string;
  /** Shown once every page is loaded; omit to render nothing */
  endMessage?: string;
}

/**
 * Place after any list or table: loads the next page when it scrolls into view.
 * Works with `useInfiniteList(...).trigger`.
 */
export function InfiniteScrollTrigger({
  hasMore,
  isLoadingMore,
  onLoadMore,
  disabled,
  rootMargin = '200px',
  endMessage,
}: InfiniteScrollTriggerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const active = hasMore && !isLoadingMore && !disabled;

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    // Re-created after every page load, so if the trigger is still visible
    // (page shorter than the viewport) the next page loads straight away
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onLoadMore(); },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [active, onLoadMore, rootMargin]);

  if (disabled) return null;

  return (
    <div ref={ref} className="flex min-h-12 items-center justify-center py-3 text-sm text-muted-foreground">
      {isLoadingMore ? (
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading more...
        </span>
      ) : hasMore ? (
        // Fallback for keyboard users and browsers without IntersectionObserver
        <Button variant="ghost" size="sm" onClick={onLoadMore}>
          Load more
        </Button>
      ) : (
        endMessage
      )}
    </div>
  );
}
