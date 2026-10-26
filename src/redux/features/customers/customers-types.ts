import type { InfiniteListParams } from '@/redux/api/types';

/** One customer (the companies that raise complaints) */
export interface Customer {
  id: number;
  name: string;
  /** Short unique code, e.g. "ACME2" */
  code: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
}

export interface CustomerListArgs extends InfiniteListParams {
  /** true = GET /admin/customers (super admins); false = the shared read-only list */
  admin: boolean;
  search?: string;
  /** 1 = active only, 0 = inactive only; leave out for all */
  is_active?: 0 | 1;
}

/** Body for POST /admin/customers */
export interface CreateCustomerRequest {
  name: string;
  code?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  is_active?: boolean;
}

/** Body for PATCH /admin/customers/{id}; send only what changes */
export interface UpdateCustomerRequest extends Partial<CreateCustomerRequest> {
  id: number;
}
