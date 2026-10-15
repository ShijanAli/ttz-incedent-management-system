/** Envelope every backend response is wrapped in. */
export interface ApiResponse<T> {
  success: boolean;
  message: string | null;
  data: T;
  /** Laravel-style validation errors, keyed by request field */
  errors?: Record<string, string[]>;
  /** Machine-readable error code, e.g. INVALID_OTP */
  code?: string;
}

/** Laravel paginator `meta` block sent with list endpoints */
export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

/** Envelope for paginated list endpoints */
export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}

/** What paginated queries hand to components */
export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

/**
 * Filters shared by every infinite list. The page number is managed by the
 * infinite query itself, so it is never part of the query arg.
 */
export interface InfiniteListParams {
  per_page?: number;
}

export const toPaginated = <T,>(res: PaginatedApiResponse<T>): Paginated<T> => ({
  items: res.data,
  meta: res.meta,
});
