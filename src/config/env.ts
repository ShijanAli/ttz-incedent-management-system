const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error('VITE_API_BASE_URL is not set. Copy .env.example to .env and fill it in.');
}

export const env = {
  /** Backend origin without a trailing slash, e.g. https://api.example.com */
  apiBaseUrl: apiBaseUrl.replace(/\/+$/, ''),
} as const;
