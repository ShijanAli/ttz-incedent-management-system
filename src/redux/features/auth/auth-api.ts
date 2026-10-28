import { baseApi } from '@/redux/api/base-api';
import { ENDPOINTS } from '@/redux/api/endpoints';
import type { ApiResponse } from '@/redux/api/types';
import { credentialsReceived, passwordChanged, userReceived } from './auth-slice';
import type {
  AuthPayload,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  MeResponse,
  ProfileStats,
  ResetPasswordRequest,
  UpdateProfileRequest,
  VerifyForgotOtpRequest,
  VerifyForgotOtpResponse,
} from './auth-types';

/** Multipart body for a profile update that includes a new photo */
function toProfileFormData({ photo, ...fields }: UpdateProfileRequest) {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => { if (value !== undefined) form.append(key, value); });
  if (photo) form.append('photo', photo);
  return form;
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<AuthPayload, LoginRequest & { remember?: boolean }>({
      query: ({ email, password }) => ({
        url: ENDPOINTS.AUTH.LOGIN,
        method: 'POST',
        body: { email, password },
      }),
      transformResponse: (res: ApiResponse<AuthPayload>) => res.data,
      async onQueryStarted({ remember = true }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(credentialsReceived({ ...data, remember }));
        } catch {
          // Error is surfaced to the caller through the mutation result
        }
      },
    }),

    getMe: build.query<MeResponse, void>({
      query: () => ENDPOINTS.AUTH.ME,
      transformResponse: (res: ApiResponse<MeResponse>) => res.data,
      providesTags: ['Me'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(userReceived(data));
        } catch {
          // 401s are handled by the base query (refresh or logout)
        }
      },
    }),

    getProfileStats: build.query<ProfileStats, void>({
      query: () => ENDPOINTS.PROFILE_STATS,
      transformResponse: (res: ApiResponse<ProfileStats>) => res.data,
    }),

    changePassword: build.mutation<ApiResponse<Partial<AuthPayload> | null>, ChangePasswordRequest>({
      query: (body) => ({ url: ENDPOINTS.AUTH.CHANGE_PASSWORD, method: 'POST', body }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // Some backends rotate tokens on password change; keep them if returned
          if (data.data?.access_token && data.data.refresh_token && data.data.user && data.data.access) {
            dispatch(credentialsReceived(data.data as AuthPayload));
          }
          dispatch(passwordChanged());
        } catch {
          // handled by caller
        }
      },
      invalidatesTags: (result) => (result ? ['Me'] : []),
    }),

    /** PATCH with JSON for field changes; POST with multipart when a photo is uploaded */
    updateProfile: build.mutation<ApiResponse<unknown>, UpdateProfileRequest>({
      query: (req) =>
        req.photo
          ? { url: ENDPOINTS.PROFILE, method: 'POST', body: toProfileFormData(req) }
          : { url: ENDPOINTS.PROFILE, method: 'PATCH', body: req },
      invalidatesTags: (result) => (result ? ['Me', 'User'] : []),
    }),

    /** Takes the token explicitly because local auth state is cleared before this request runs. */
    logout: build.mutation<ApiResponse<null>, string>({
      query: (accessToken) => ({
        url: ENDPOINTS.AUTH.LOGOUT,
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    }),

    forgotPassword: build.mutation<ApiResponse<unknown>, ForgotPasswordRequest>({
      query: (body) => ({ url: ENDPOINTS.AUTH.FORGOT_PASSWORD, method: 'POST', body }),
    }),

    verifyForgotOtp: build.mutation<ApiResponse<VerifyForgotOtpResponse | null>, VerifyForgotOtpRequest>({
      query: (body) => ({ url: ENDPOINTS.AUTH.VERIFY_FORGOT_OTP, method: 'POST', body }),
    }),

    resetPassword: build.mutation<ApiResponse<unknown>, ResetPasswordRequest>({
      query: (body) => ({ url: ENDPOINTS.AUTH.RESET_PASSWORD, method: 'POST', body }),
    }),
  }),
});

export const {
  useLoginMutation,
  useGetMeQuery,
  useGetProfileStatsQuery,
  useChangePasswordMutation,
  useUpdateProfileMutation,
  useLogoutMutation,
  useForgotPasswordMutation,
  useVerifyForgotOtpMutation,
  useResetPasswordMutation,
} = authApi;
