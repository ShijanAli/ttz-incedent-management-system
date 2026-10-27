import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { InfiniteScrollTrigger } from '@/components/shared/infinite-scroll-trigger';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { parseApiError } from '@/lib/api-error';
import { getProjectStateMeta } from '@/lib/project-utils';
import { useGetProjectsInfiniteQuery } from '@/redux/features/projects/projects-api';
import type { ApiProject } from '@/redux/features/projects/projects-types';
import { ProjectLogo } from '@/components/projects/project-logo';

interface ProjectSearchListProps {
  /** Rendered on the right of each row, e.g. a checkbox */
  renderAction: (project: ApiProject) => React.ReactNode;
  emptyMessage?: string;
}

/**
 * Searchable, infinitely scrolling list of active projects from the projects API.
 * Search runs on the server, debounced.
 */
export function ProjectSearchList({ renderAction, emptyMessage = 'No projects found.' }: ProjectSearchListProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const list = useInfiniteList(
    useGetProjectsInfiniteQuery({ status: 'active', search: debouncedSearch || undefined }),
  );
  const searching = search.trim() !== debouncedSearch || (list.isFetching && !list.trigger.isLoadingMore);

  return (
    <div>
      <div className="relative mb-3">
        {searching ? (
          <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          type="search"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          aria-label="Search projects"
        />
      </div>

      <div className="max-h-[240px] overflow-y-auto rounded-lg border">
        {list.showSkeleton ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading projects...
          </div>
        ) : list.isError ? (
          <div className="py-8 text-center text-sm text-destructive">
            {parseApiError(list.error, 'Failed to load projects.').message}
          </div>
        ) : list.items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</div>
        ) : (
          <div className="divide-y">
            {list.items.map((project) => (
              <div key={project.id} className="flex items-center gap-3 px-3 py-2.5">
                <ProjectLogo project={project} className="h-8 w-8 rounded-lg text-[10px]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{project.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {getProjectStateMeta(project.status).label} · {project.member_count} member{project.member_count !== 1 ? 's' : ''}
                  </div>
                </div>
                {renderAction(project)}
              </div>
            ))}
          </div>
        )}
        <InfiniteScrollTrigger {...list.trigger} disabled={list.trigger.disabled || list.showSkeleton} />
      </div>
    </div>
  );
}
