import type { Me, MeResponse, UpdateMeInput } from '@shared/schemas/users'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'wouter'
import { ApiError } from '@/lib/api'
import { clearClientCaches } from '@/lib/query-client'
import { disconnectRealtime } from '@/lib/realtime'
import { authApi } from './api'

export const authKeys = {
  me: ['me'] as const,
  status: ['auth', 'status'] as const,
}

export function useMe() {
  return useQuery({ queryKey: authKeys.me, queryFn: authApi.me, staleTime: 60_000 })
}

export function useCurrentUser(): Me | null {
  const { data } = useMe()
  return data?.kind === 'user' ? data.user : null
}

export function useAuthStatus(enabled: boolean) {
  return useQuery({ queryKey: authKeys.status, queryFn: authApi.status, enabled, staleTime: 0 })
}

function useSignIn<I>(fn: (input: I) => Promise<MeResponse>, onError?: (error: Error) => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async (me) => {
      await clearClientCaches()
      qc.setQueryData(authKeys.me, me)
    },
    onError,
  })
}

export function useLogin() {
  return useSignIn(authApi.login)
}

export function useSetup() {
  return useSignIn(authApi.setup)
}

export function useRegister() {
  const qc = useQueryClient()
  return useSignIn(authApi.register, (error) => {
    // The administrator may have closed registration, or reset the data, since the page loaded.
    if (error instanceof ApiError && (error.status === 403 || error.status === 409)) {
      void qc.invalidateQueries({ queryKey: authKeys.status })
    }
  })
}

export function useLogout() {
  const qc = useQueryClient()
  const [, navigate] = useLocation()
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: async () => {
      disconnectRealtime()
      await clearClientCaches()
      qc.setQueryData<MeResponse>(authKeys.me, { kind: 'anonymous' })
      navigate('/login', { replace: true })
    },
  })
}

export function useUpdateMe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateMeInput) => authApi.updateMe(input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: authKeys.me })
      const previous = qc.getQueryData<MeResponse>(authKeys.me)
      if (previous?.kind === 'user' && input.prefs) {
        const optimistic: MeResponse = {
          kind: 'user',
          user: { ...previous.user, prefs: { ...previous.user.prefs, ...input.prefs } },
        }
        qc.setQueryData(authKeys.me, optimistic)
      }
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) qc.setQueryData(authKeys.me, context.previous)
    },
    onSuccess: (user) => {
      const next: MeResponse = { kind: 'user', user }
      qc.setQueryData(authKeys.me, next)
      void qc.invalidateQueries({ queryKey: ['members'] })
    },
  })
}
