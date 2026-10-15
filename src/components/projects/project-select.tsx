import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { InfiniteScrollTrigger } from '@/components/shared/infinite-scroll-trigger';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { getProjectColor } from '@/lib/project-utils';
import { useGetProjectsInfiniteQuery } from '@/redux/features/projects/projects-api';
import type { ApiProject } from '@/redux/features/projects/projects-types';

interface ProjectSelectProps {
  /** Project id as a string ("" for none) */
  value: string;
  onChange: (projectId: string, project: ApiProject | undefined) => void;
  /** Only offer projects that pass this check, e.g. ones the user can create issues in */
  filter?: (project: ApiProject) => boolean;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}

/**
 * Dropdown of active projects from the projects API. More projects load as the
 * list is scrolled, so it works no matter how many projects exist.
 */
export function ProjectSelect({
  value, onChange, filter, disabled, placeholder = 'Select project...', id,
}: ProjectSelectProps) {
  const list = useInfiniteList(useGetProjectsInfiniteQuery({ status: 'active' }));
  const projects = useMemo(() => (filter ? list.items.filter(filter) : list.items), [list.items, filter]);

  return (
    <Select
      value={value || undefined}
      onValueChange={(v) => onChange(v, projects.find((p) => String(p.id) === v))}
      disabled={disabled}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder={list.showSkeleton ? 'Loading projects...' : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {list.isError ? (
          <div className="px-2 py-3 text-center text-xs text-destructive">Failed to load projects.</div>
        ) : list.showSkeleton ? (
          <div className="flex items-center justify-center gap-2 px-2 py-3 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading projects...
          </div>
        ) : projects.length === 0 && !list.trigger.hasMore ? (
          <div className="px-2 py-3 text-center text-xs text-muted-foreground">No projects available.</div>
        ) : (
          projects.map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: getProjectColor(p) }} />
                {p.name}
              </span>
            </SelectItem>
          ))
        )}
        <InfiniteScrollTrigger {...list.trigger} disabled={list.trigger.disabled || list.showSkeleton} rootMargin="40px" />
      </SelectContent>
    </Select>
  );
}
