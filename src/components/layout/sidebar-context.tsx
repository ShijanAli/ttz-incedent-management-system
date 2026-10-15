import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export const SIDEBAR_WIDTH = 240;
export const SIDEBAR_COLLAPSED_WIDTH = 60;

const STORAGE_KEY = 'sidebar-collapsed';

interface SidebarContextValue {
  collapsed: boolean;
  toggleCollapsed: () => void;
  /** Current desktop width in px */
  width: number;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Shares the sidebar's collapsed state with the layout so the content area can
 * reclaim the space. Anything positioned against the sidebar edge should use
 * the `--sidebar-width` CSS variable set by AppLayout rather than a fixed px value.
 */
export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Preference just won't persist
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ collapsed, toggleCollapsed, width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }),
    [collapsed, toggleCollapsed],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider');
  return ctx;
}
