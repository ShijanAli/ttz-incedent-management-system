import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/redux/store';
import type { ApiUser, AuthPayload, MeResponse, UserAccess } from './auth-types';
import { loadTokens } from './token-storage';

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  /** Epoch milliseconds when the access token expires */
  expiresAt: number | null;
  /** Persist tokens across browser restarts ("Keep me signed in") */
  remember: boolean;
  user: ApiUser | null;
  access: UserAccess | null;
  mustChangePassword: boolean;
}

const stored = loadTokens();

const initialState: AuthState = {
  accessToken: stored?.accessToken ?? null,
  refreshToken: stored?.refreshToken ?? null,
  expiresAt: stored?.expiresAt ?? null,
  remember: stored?.remember ?? true,
  user: null,
  access: null,
  mustChangePassword: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** Login or token refresh succeeded. `remember` is omitted on refresh to keep the current choice. */
    credentialsReceived(state, action: PayloadAction<AuthPayload & { remember?: boolean }>) {
      const { access_token, refresh_token, expires_in, user, access, must_change_password, remember } = action.payload;
      state.accessToken = access_token;
      state.refreshToken = refresh_token;
      state.expiresAt = Date.now() + expires_in * 1000;
      if (remember !== undefined) state.remember = remember;
      state.user = user;
      state.access = access;
      state.mustChangePassword = must_change_password || user.must_change_password;
    },
    /** Fresh profile from /auth/me */
    userReceived(state, action: PayloadAction<MeResponse>) {
      const { access, ...user } = action.payload;
      state.user = user;
      state.access = access;
      state.mustChangePassword = user.must_change_password;
    },
    passwordChanged(state) {
      state.mustChangePassword = false;
      if (state.user) state.user.must_change_password = false;
    },
    loggedOut() {
      return { ...initialState, accessToken: null, refreshToken: null, expiresAt: null, remember: true };
    },
  },
});

export const { credentialsReceived, userReceived, passwordChanged, loggedOut } = authSlice.actions;
export default authSlice.reducer;

export const selectAuth = (state: RootState) => state.auth;
export const selectAccessToken = (state: RootState) => state.auth.accessToken;
export const selectCurrentUser = (state: RootState) => state.auth.user;
export const selectUserAccess = (state: RootState) => state.auth.access;
export const selectIsAuthenticated = (state: RootState) => Boolean(state.auth.accessToken && state.auth.user);
export const selectMustChangePassword = (state: RootState) => state.auth.mustChangePassword;
