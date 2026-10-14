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
