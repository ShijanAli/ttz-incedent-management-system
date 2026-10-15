import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertTriangle, Calendar, Loader2, MoreVertical, Pencil, Plus, Power, PowerOff, RotateCw, Search,
  Trash2, Users as UsersIcon, UsersRound, X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { parseApiError } from '@/lib/api-error';
import { formatDate } from '@/lib/shared-utils';
import { useGetGroupsInfiniteQuery } from '@/redux/features/groups/groups-api';
import type { ApiGroup } from '@/redux/features/groups/groups-types';
import { PageHeader } from '@/components/shared/page-header';
import { GroupFormDialog } from '@/components/groups/group-form-dialog';
import { GroupStatusBadge } from '@/components/groups/group-status-badge';
import { useGroupActions, type GroupActionType } from '@/components/groups/use-group-actions';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { InfiniteScrollTrigger } from '@/components/shared/infinite-scroll-trigger';
import { ROW_INDEX_ATTR, ScrollPositionIndicator } from '@/components/shared/scroll-position-indicator';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const ALL = 'all';
const STATUS_FILTER_PARAM: Record<string, 0 | 1 | undefined> = { [ALL]: undefined, active: 1, inactive: 0 };

export default function GroupsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ApiGroup | null>(null);
  const actions = useGroupActions();
  const gridRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebouncedValue(search.trim());
  const isSearchPending = search.trim() !== debouncedSearch;

  // Filters run on the API (?search, ?is_active); "All" leaves the param out
  const list = useInfiniteList(
    useGetGroupsInfiniteQuery({
      search: debouncedSearch || undefined,
      is_active: STATUS_FILTER_PARAM[statusFilter],
    }),
  );

  const groups = list.items;
  const hasFilters = search !== '' || statusFilter !== ALL;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter(ALL);
  };

  const openForm = (group: ApiGroup | null) => {
    setEditingGroup(group);
    setFormOpen(true);
  };

  const canCreate = hasPermission('groups.create');
  const canUpdate = hasPermission('groups.update');
  const canDelete = hasPermission('groups.delete');

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Groups"
        description="Teams of people you can attach to projects to give everyone access at once."
        breadcrumbs={[{ label: 'Groups' }]}
        actions={
          canCreate && (
            <Button onClick={() => openForm(null)}>
              <Plus className="mr-2 h-4 w-4" />
              New Group
            </Button>
          )
        }
      />

      <Card>
        <CardContent className="p-4">
          {/* Filters */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-xs">
              {isSearchPending || (list.isFetching && !list.showSkeleton && debouncedSearch) ? (
                <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              ) : (
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              )}
              <Input
                type="search"
                placeholder="Search groups..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                aria-label="Search groups"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X className="mr-1.5 h-4 w-4" />
                Clear filters
              </Button>
            )}
            <div className="flex items-center gap-3 sm:ml-auto">
              <span className="text-sm text-muted-foreground">
                {groups.length} of {list.total} group{list.total !== 1 ? 's' : ''}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={list.refresh}
                disabled={list.isFetching}
                aria-label="Refresh groups"
                title="Refresh"
              >
                <RotateCw className={cn('h-4 w-4', list.isRefreshing && 'animate-spin')} />
              </Button>
            </div>
          </div>

          {/* Group cards */}
          {list.showSkeleton ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[150px] rounded-xl" />)}
            </div>
          ) : list.isError ? (
            <div className="flex flex-col items-center gap-3 py-12 text-sm">
              <span className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {parseApiError(list.error, 'Failed to load groups.').message}
              </span>
              <Button variant="outline" size="sm" onClick={list.refresh} disabled={list.isFetching}>
                <RotateCw className="mr-2 h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          ) : groups.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {hasFilters ? 'No groups match your filters.' : `No groups yet.${canCreate ? ' Create one to get started.' : ''}`}
            </div>
          ) : (
            <div ref={gridRef} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((group, index) => (
                <GroupCard
                  key={group.id}
                  index={index}
                  group={group}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  onOpen={() => navigate(`/groups/${group.id}`)}
                  onEdit={() => openForm(group)}
                  onAction={(action) => actions.request(group, action)}
                />
              ))}
            </div>
          )}

          <InfiniteScrollTrigger
            {...list.trigger}
            disabled={list.trigger.disabled || list.showSkeleton}
            endMessage={groups.length > 0 ? 'No more groups' : undefined}
          />
        </CardContent>
      </Card>

      <ScrollPositionIndicator containerRef={gridRef} total={list.total} />

      <GroupFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        group={editingGroup}
        onCreated={(group) => navigate(`/groups/${group.id}`)}
      />

      <ConfirmDialog {...actions.dialogProps} />
    </div>
  );
}

interface GroupCardProps {
  index: number;
  group: ApiGroup;
  canUpdate: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onAction: (action: GroupActionType) => void;
}

function GroupCard({ index, group, canUpdate, canDelete, onOpen, onEdit, onAction }: GroupCardProps) {
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
      className={cn(
        'group relative cursor-pointer rounded-xl border p-4 transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        !group.is_active && 'bg-muted/30',
      )}
      {...{ [ROW_INDEX_ATTR]: index }}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            group.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          <UsersRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium">{group.name}</h3>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{group.description || 'No description.'}</p>
        </div>
        {(canUpdate || canDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Actions for ${group.name}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {canUpdate && (
                <>
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit group
                  </DropdownMenuItem>
                  {group.is_active ? (
                    <DropdownMenuItem onClick={() => onAction('deactivate')} className="text-amber-600">
                      <PowerOff className="mr-2 h-4 w-4" />
                      Deactivate
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => onAction('activate')} className="text-emerald-600">
                      <Power className="mr-2 h-4 w-4" />
                      Activate
                    </DropdownMenuItem>
                  )}
                </>
              )}
              {canDelete && (
                <>
                  {canUpdate && <DropdownMenuSeparator />}
                  <DropdownMenuItem onClick={() => onAction('delete')} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete group
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
        <GroupStatusBadge active={group.is_active} />
        <span className="flex items-center gap-1">
          <UsersIcon className="h-3.5 w-3.5" />
          {group.member_count} member{group.member_count !== 1 ? 's' : ''}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {formatDate(group.created_at)}
        </span>
      </div>
    </div>
  );
}
