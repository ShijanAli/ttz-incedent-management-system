import { useState } from 'react';
import {
  AlertTriangle, Building2, Loader2, Mail, MoreVertical, Pencil, Phone, Plus, Power, PowerOff, RotateCw, Search,
  Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { parseApiError } from '@/lib/api-error';
import {
  useDeleteCustomerMutation, useGetCustomersInfiniteQuery, useUpdateCustomerMutation,
} from '@/redux/features/customers/customers-api';
import type { Customer } from '@/redux/features/customers/customers-types';
import { PageHeader } from '@/components/shared/page-header';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { InfiniteScrollTrigger } from '@/components/shared/infinite-scroll-trigger';
import { TableSkeletonRows } from '@/components/shared/table-skeleton-rows';
import { CustomerFormDialog } from '@/components/customers/customer-form-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const ALL = 'all';
const STATUS_PARAM: Record<string, 0 | 1 | undefined> = { [ALL]: undefined, active: 1, inactive: 0 };
const COLUMN_COUNT = 6;

/** Super admin: the customers that complaints can be filed for */
export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null);
  const [updateCustomer] = useUpdateCustomerMutation();
  const [deleteCustomer] = useDeleteCustomerMutation();

  const debouncedSearch = useDebouncedValue(search.trim());
  const isSearchPending = search.trim() !== debouncedSearch;
  const list = useInfiniteList(
    useGetCustomersInfiniteQuery({
      admin: true,
      search: debouncedSearch || undefined,
      is_active: STATUS_PARAM[statusFilter],
    }),
  );
  const customers = list.items;
  const hasFilters = search !== '' || statusFilter !== ALL;

  const openForm = (customer: Customer | null) => {
    setEditing(customer);
    setFormOpen(true);
  };

  const toggleActive = async (c: Customer) => {
    try {
      await updateCustomer({ id: c.id, is_active: !c.is_active }).unwrap();
      toast.success(c.is_active ? `${c.name} deactivated` : `${c.name} activated`);
    } catch (err) {
      toast.error('Failed to update customer', { description: parseApiError(err).message });
    }
  };

  const handleDelete = async (c: Customer) => {
    try {
      const res = await deleteCustomer(c.id).unwrap();
      // Customers with complaints are deactivated instead of deleted; the API says which
      toast.success(res.message || `${c.name} removed`);
    } catch (err) {
      toast.error('Failed to delete customer', { description: parseApiError(err).message });
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Customers"
        description="The customers complaints come from. Pick one when an issue's source is a customer complaint."
        breadcrumbs={[{ label: 'Customers' }]}
        actions={
          <Button onClick={() => openForm(null)}>
            <Plus className="mr-2 h-4 w-4" /> New Customer
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4">
          {/* Filters */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative max-w-xs flex-1">
              {isSearchPending || (list.isFetching && !list.showSkeleton && debouncedSearch) ? (
                <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              ) : (
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              )}
              <Input
                type="search"
                placeholder="Search name or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                aria-label="Search customers"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" aria-label="Filter by status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setSearch(''); setStatusFilter(ALL); }}>
                <X className="mr-1.5 h-4 w-4" /> Clear filters
              </Button>
            )}
            <div className="flex items-center gap-3 sm:ml-auto">
              <span className="text-sm text-muted-foreground">
                {customers.length} of {list.total} customer{list.total !== 1 ? 's' : ''}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={list.refresh}
                disabled={list.isFetching}
                aria-label="Refresh customers"
                title="Refresh"
              >
                <RotateCw className={cn('h-4 w-4', list.isRefreshing && 'animate-spin')} />
              </Button>
            </div>
          </div>

          {list.isError ? (
            <div className="flex flex-col items-center gap-3 py-12 text-sm">
              <span className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {parseApiError(list.error, 'Failed to load customers.').message}
              </span>
              <Button variant="outline" size="sm" onClick={list.refresh}>Retry</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">SL</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.showSkeleton ? (
                    <TableSkeletonRows columns={COLUMN_COUNT} />
                  ) : customers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={COLUMN_COUNT} className="py-12 text-center text-muted-foreground">
                        {hasFilters ? 'No customers match your filters.' : 'No customers yet. Add the first one.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    customers.map((c, i) => (
                      <TableRow key={c.id} className={cn(!c.is_active && 'opacity-60')}>
                        <TableCell className="text-sm tabular-nums text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <button type="button" onClick={() => openForm(c)} className="flex items-center gap-2 text-left font-medium hover:text-primary">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                              <Building2 className="h-4 w-4" />
                            </span>
                            {c.name}
                          </button>
                        </TableCell>
                        <TableCell>
                          {c.code ? <span className="font-mono text-xs">{c.code}</span> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5 text-sm">
                            {c.contact_email && (
                              <a href={`mailto:${c.contact_email}`} className="flex items-center gap-1.5 hover:text-primary">
                                <Mail className="h-3 w-3 text-muted-foreground" /> {c.contact_email}
                              </a>
                            )}
                            {c.contact_phone && (
                              <a href={`tel:${c.contact_phone}`} className="flex items-center gap-1.5 hover:text-primary">
                                <Phone className="h-3 w-3 text-muted-foreground" /> {c.contact_phone}
                              </a>
                            )}
                            {!c.contact_email && !c.contact_phone && <span className="text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={c.is_active
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                              : 'text-muted-foreground'}
                          >
                            {c.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${c.name}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openForm(c)}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleActive(c)}>
                                {c.is_active ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}
                                {c.is_active ? 'Deactivate' : 'Activate'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setConfirmDelete(c)} className="text-red-600">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <InfiniteScrollTrigger
            {...list.trigger}
            disabled={list.trigger.disabled || list.showSkeleton}
            endMessage={customers.length > 0 ? 'No more customers' : undefined}
          />
        </CardContent>
      </Card>

      <CustomerFormDialog open={formOpen} onOpenChange={setFormOpen} customer={editing} />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Delete customer"
        description={`Delete "${confirmDelete?.name}"? If any issue is linked to this customer, it will be deactivated instead so those issues keep their customer.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => { if (confirmDelete) await handleDelete(confirmDelete); }}
      />
    </div>
  );
}
