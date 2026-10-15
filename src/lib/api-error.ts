import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { SerializedError } from '@reduxjs/toolkit';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import type { ApiResponse } from '@/redux/api/types';

export interface ApiError {
  status?: number | string;
  message: string;
  /** Field-level validation messages from the backend */
  fieldErrors: Record<string, string[]>;
  code?: string;
}

const isFetchError = (e: unknown): e is FetchBaseQueryError =>
  typeof e === 'object' && e !== null && 'status' in e;

/** Normalizes any RTK Query error into a displayable shape. */
export function parseApiError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): ApiError {
  if (isFetchError(error)) {
    if (error.status === 'FETCH_ERROR') {
      return { status: error.status, message: 'Unable to reach the server. Check your connection and try again.', fieldErrors: {} };
    }
    if (error.status === 'TIMEOUT_ERROR') {
      return { status: error.status, message: 'The server took too long to respond. Please try again.', fieldErrors: {} };
    }
    const body = error.data as Partial<ApiResponse<unknown>> | undefined;
    return {
      status: error.status,
      message: body?.message || fallback,
      fieldErrors: body?.errors ?? {},
      code: body?.code,
    };
  }
  const message = (error as SerializedError | undefined)?.message;
  return { message: message || fallback, fieldErrors: {} };
}

/**
 * Puts backend validation messages onto matching form fields.
 * Returns true when at least one field received an error.
 */
export function applyFieldErrors<T extends FieldValues>(
  error: ApiError,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  let applied = false;
  const entries = Object.entries(error.fieldErrors);
  for (const field of fields) {
    // Laravel keys array errors by index, e.g. "members.0.user_id" belongs to "members"
    const messages =
      error.fieldErrors[field] ?? entries.find(([key]) => key.startsWith(`${field}.`))?.[1];
    if (messages?.length) {
      setError(field, { type: 'server', message: messages[0] });
      applied = true;
    }
  }
  return applied;
}
