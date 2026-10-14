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

setupListeners(store.dispatch);

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
