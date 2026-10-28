import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, Clock, Loader2, Search, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/utils';
import {
  clearRecent, forgetRecent, onRecentChange, readRecent, recentHref, rememberRecent, type RecentItem,
} from '@/lib/recent-search';
import { useGetIssuesInfiniteQuery } from '@/redux/features/issues/issues-api';
import { useGetProjectsInfiniteQuery } from '@/redux/features/projects/projects-api';
import { IssueStatusBadge } from '@/components/issues/issue-badges';
import { ProjectLogo } from '@/components/projects/project-logo';

const MIN_CHARS = 2;
const RESULTS_PER_GROUP = 5;
const DEBOUNCE_MS = 300;

type Result =
  | { kind: 'project' | 'issue'; id: number; to: string; item: RecentItem }
  | { kind: 'all-issues'; id: 0; to: string };

export function GlobalSearch() {
  const navigate = useNavigate();
  const { session, hasPermission, isSuperAdmin } = useAuth();
  const userId = session?.user.id;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);

  useEffect(() => {
    if (!userId) {
      setRecent([]);
      return;
    }
    const load = () => setRecent(readRecent(userId));
    load();
    return onRecentChange(load);
  }, [userId]);

  const term = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const ready = term.length >= MIN_CHARS;
  const canProjects = hasPermission('projects.view');
  const canIssues = hasPermission('issues.view');

  const projectsQuery = useGetProjectsInfiniteQuery(
    { search: term, per_page: RESULTS_PER_GROUP },
    { skip: !ready || !canProjects },
  );
  const issuesQuery = useGetIssuesInfiniteQuery(
    { scope: isSuperAdmin ? 'admin' : 'my', search: term, per_page: RESULTS_PER_GROUP },
    { skip: !ready || !canIssues },
  );
  const projects = projectsQuery.data?.pages[0]?.items ?? [];
  const issues = issuesQuery.data?.pages[0]?.items ?? [];
  const issueTotal = issuesQuery.data?.pages[0]?.meta.total ?? 0;

  const typing = query.trim() !== term;
  const loading = typing || projectsQuery.isFetching || issuesQuery.isFetching;
  const failed = projectsQuery.isError || issuesQuery.isError;

  const showRecent = open && query.trim() === '' && recent.length > 0;

  const results = useMemo<Result[]>(() => showRecent ? recent.map((item) => ({ kind: item.kind, id: item.id, to: recentHref(item), item })) : [
    ...projects.map((p) => ({
      kind: 'project' as const, id: p.id, to: `/projects/${p.id}`,
      item: { kind: 'project' as const, id: p.id, name: p.name, color: p.color, logo_url: p.logo_url, status: p.status },
    })),
    ...issues.map((i) => ({
      kind: 'issue' as const, id: i.id, to: `/issues/${i.id}`,
      item: { kind: 'issue' as const, id: i.id, code: i.code, title: i.title, projectName: i.project?.name },
    })),
    ...(issueTotal > issues.length ? [{ kind: 'all-issues' as const, id: 0 as const, to: `/issues?q=${encodeURIComponent(term)}` }] : []),
  ], [showRecent, recent, projects, issues, issueTotal, term]);

  useEffect(() => setActive(0), [term, showRecent]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onShortcut);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onShortcut);
    };
  }, []);

  const reset = () => {
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const go = (to: string) => {
    reset();
    navigate(to);
  };

  /** Opening a project or issue moves it to the top of the recent list */
  const remember = (result: Result | undefined) => {
    if (userId && result && result.kind !== 'all-issues') rememberRecent(userId, result.item);
  };

  const pick = (result: Result) => {
    remember(result);
    go(result.to);
  };

  const removeRecent = (e: React.MouseEvent, item: RecentItem) => {
    e.preventDefault();
    e.stopPropagation();
    if (userId) forgetRecent(userId, item.kind, item.id);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open || results.length === 0) {
      // Enter with nothing to pick still searches the issues page
      if (e.key === 'Enter' && query.trim().length >= MIN_CHARS && canIssues) go(`/issues?q=${encodeURIComponent(query.trim())}`);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[Math.min(active, results.length - 1)]);
    }
  };

  const showDropdown = showRecent || (open && query.trim().length >= MIN_CHARS);
  const isActive = (kind: Result['kind'], id: number) => {
    const r = results[active];
    return r?.kind === kind && r.id === id;
  };
  const rowClass = (on: boolean) =>
    cn('flex items-center gap-2 rounded-md px-3 py-2 text-sm', on ? 'bg-accent' : 'hover:bg-accent');

  return (
    <div ref={boxRef} className="relative max-w-md flex-1">
      <div className="relative">
        {loading && showDropdown ? (
          <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <input
          ref={inputRef}
          type="search"
          placeholder="Search projects, issues..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="global-search-results"
          aria-label="Search projects and issues"
          className="h-9 w-full rounded-lg border bg-muted/40 pl-9 pr-14 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
          Ctrl K
        </kbd>
      </div>

      {showDropdown && (
        <div id="global-search-results" role="listbox" className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[420px] overflow-y-auto rounded-lg border bg-popover p-2 shadow-lg">
          {showRecent ? (
            <div>
              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-xs font-semibold text-muted-foreground">Recent</span>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => userId && clearRecent(userId)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              </div>
              {recent.map((item, index) => {
                const on = active === index;
                return (
                  <Link
                    key={`${item.kind}-${item.id}`}
                    to={recentHref(item)}
                    onClick={() => { remember(results[index]); reset(); }}
                    onMouseEnter={() => setActive(index)}
                    role="option"
                    aria-selected={on}
                    className={cn(rowClass(on), 'group')}
                  >
                    {item.kind === 'project' ? (
                      <>
                        <ProjectLogo project={item} className="h-7 w-7 rounded-md text-[9px]" />
                        <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
                      </>
                    ) : (
                      <>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">
                            <span className="mr-1.5 font-mono text-xs text-muted-foreground">{item.code}</span>
                            {item.title}
                          </span>
                          {item.projectName && <span className="block truncate text-xs text-muted-foreground">{item.projectName}</span>}
                        </span>
                      </>
                    )}
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => removeRecent(e, item)}
                      aria-label="Remove from recent"
                      className="shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:bg-background hover:text-foreground group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </Link>
                );
              })}
            </div>
          ) : !ready || (loading && results.length === 0) ? (
            <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching...
            </div>
          ) : failed && results.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-destructive">Search failed. Try again.</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No results for &quot;{term}&quot;
            </div>
          ) : (
            <>
              {projects.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-1 text-xs font-semibold text-muted-foreground">Projects</div>
                  {projects.map((p) => (
                    <Link
                      key={p.id}
                      to={`/projects/${p.id}`}
                      onClick={() => { remember(results.find((r) => r.kind === 'project' && r.id === p.id)); reset(); }}
                      onMouseEnter={() => setActive(results.findIndex((r) => r.kind === 'project' && r.id === p.id))}
                      role="option"
                      aria-selected={isActive('project', p.id)}
                      className={rowClass(isActive('project', p.id))}
                    >
                      <ProjectLogo project={p} className="h-7 w-7 rounded-md text-[9px]" />
                      <span className="truncate font-medium">{p.name}</span>
                      {p.status && p.status !== 'active' && (
                        <span className="ml-auto shrink-0 text-xs capitalize text-muted-foreground">{p.status.replace(/_/g, ' ')}</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
              {issues.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-xs font-semibold text-muted-foreground">Issues</div>
                  {issues.map((i) => (
                    <Link
                      key={i.id}
                      to={`/issues/${i.id}`}
                      onClick={() => { remember(results.find((r) => r.kind === 'issue' && r.id === i.id)); reset(); }}
                      onMouseEnter={() => setActive(results.findIndex((r) => r.kind === 'issue' && r.id === i.id))}
                      role="option"
                      aria-selected={isActive('issue', i.id)}
                      className={rowClass(isActive('issue', i.id))}
                    >
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">{i.code}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{i.title}</span>
                        {i.project && <span className="block truncate text-xs text-muted-foreground">{i.project.name}</span>}
                      </span>
                      <span className="shrink-0"><IssueStatusBadge issue={i} /></span>
                    </Link>
                  ))}
                </div>
              )}
              {issueTotal > issues.length && (
                <Link
                  to={`/issues?q=${encodeURIComponent(term)}`}
                  onClick={reset}
                  onMouseEnter={() => setActive(results.length - 1)}
                  role="option"
                  aria-selected={isActive('all-issues', 0)}
                  className={cn(rowClass(isActive('all-issues', 0)), 'mt-1 justify-center border-t pt-2 font-medium text-primary')}
                >
                  See all {issueTotal} matching issues <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
