import { useEffect, useRef, useState, type RefObject } from 'react';
import { cn } from '@/lib/utils';

/** Marks a row the indicator should count; value is the 0-based row position */
export const ROW_INDEX_ATTR = 'data-row-index';

interface ScrollPositionIndicatorProps {
  /** Element containing the rows marked with `data-row-index` */
  containerRef: RefObject<HTMLElement | null>;
  total: number;
  /** How long the badge stays after scrolling stops */
  hideAfterMs?: number;
}

/** 1-based position of the last row whose top is inside the viewport */
function lastVisibleRow(container: HTMLElement): number {
  const viewportBottom = window.innerHeight;
  let last = 0;
  for (const row of container.querySelectorAll<HTMLElement>(`[${ROW_INDEX_ATTR}]`)) {
    if (row.getBoundingClientRect().top >= viewportBottom) break;
    last = Number(row.getAttribute(ROW_INDEX_ATTR)) + 1;
  }
  return last;
}

/**
 * Floating "8 / 12" badge on the right edge that appears while the user scrolls
 * a long list. Mark each row with `{...{ [ROW_INDEX_ATTR]: index }}`.
 */
export function ScrollPositionIndicator({ containerRef, total, hideAfterMs = 1200 }: ScrollPositionIndicatorProps) {
  const [position, setPosition] = useState(0);
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const frame = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      // One measurement per frame, however fast the scroll events arrive
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const container = containerRef.current;
        if (!container) return;
        setPosition(lastVisibleRow(container));
        setVisible(true);
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setVisible(false), hideAfterMs);
      });
    };

    // Capture phase also catches scrolling inside nested containers
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true });
      cancelAnimationFrame(frame.current);
      clearTimeout(hideTimer.current);
    };
  }, [containerRef, hideAfterMs]);

  if (total === 0) return null;

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none fixed bottom-6 right-6 z-40 rounded-full border bg-background/95 px-3.5 py-1.5',
        'text-sm font-medium tabular-nums shadow-lg backdrop-blur transition-all duration-300',
        visible && position > 0 ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
      )}
    >
      {Math.min(position, total)}
      <span className="text-muted-foreground"> / {total}</span>
    </div>
  );
}
