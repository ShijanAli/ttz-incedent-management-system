import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { baseApi } from './api/base-api';
import authReducer from './features/auth/auth-slice';
import { clearTokens, saveTokens } from './features/auth/token-storage';

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
});

/** How long the tab must have been hidden before coming back refreshes live data */
const REFOCUS_AFTER_MS = 30_000;

/**
 * RTK Query's default treats every window "focus" as a reason to refetch, and that event
 * also fires when moving between DevTools and the page or clicking back into the window,
 * so a single click reloaded every live query. Here only a real return to the tab counts:
 * it must have been hidden (another tab, minimised) for a while. Online/offline stay as usual.
 */
setupListeners(store.dispatch, (dispatch, { onFocus, onFocusLost, onOnline, onOffline }) => {
  let hiddenAt: number | null = null;

  const handleVisibility = () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      dispatch(onFocusLost());
      return;
    }
    const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
    hiddenAt = null;
    if (away >= REFOCUS_AFTER_MS) dispatch(onFocus());
  };
  const handleOnline = () => dispatch(onOnline());
  const handleOffline = () => dispatch(onOffline());

  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return () => {
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
});

// Mirror token changes into browser storage so a reload keeps the session
let previousAuth = store.getState().auth;
store.subscribe(() => {
  const auth = store.getState().auth;
  if (
    auth.accessToken === previousAuth.accessToken &&
    auth.refreshToken === previousAuth.refreshToken &&
    auth.remember === previousAuth.remember
  ) {
    return;
  }
  previousAuth = auth;
  if (auth.accessToken && auth.refreshToken) {
    saveTokens({
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      expiresAt: auth.expiresAt ?? Date.now(),
      remember: auth.remember,
    });
  } else {
    clearTokens();
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
