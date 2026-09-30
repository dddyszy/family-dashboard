import type {
  AuthStatus,
  LoginInput,
  Me,
  MeResponse,
  RegisterInput,
  SetupInput,
  UpdateMeInput,
} from '@shared/schemas/users'
import { api } from '@/lib/api'

export const authApi = {
  status: () => api.get<AuthStatus>('/auth/status'),
  me: () => api.get<MeResponse>('/me'),
  login: (input: LoginInput) => api.post<MeResponse>('/auth/login', input),
  setup: (input: SetupInput) => api.post<MeResponse>('/auth/setup', input),
  register: (input: RegisterInput) => api.post<MeResponse>('/auth/register', input),
  logout: () => api.post<{ ok: true }>('/auth/logout'),
  updateMe: (input: UpdateMeInput) => api.patch<Me>('/me', input),
}
