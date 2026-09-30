import type { SaveDashboardInput } from '@shared/schemas/dashboard'
import type { HomeData } from '@shared/schemas/home'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type DashboardKind, homeApi } from './api'

export const homeKeys = {
  home: ['home'] as const,
  weather: ['weather'] as const,
  dashboard: (kind: DashboardKind) => ['dashboard', kind] as const,
}

export function useHome() {
  return useQuery({
    queryKey: homeKeys.home,
    queryFn: homeApi.home,
    staleTime: 30_000,
    refetchInterval: 5 * 60_000,
  })
}

export function useHomeSlice<T>(select: (data: HomeData) => T) {
  return useQuery({
    queryKey: homeKeys.home,
    queryFn: homeApi.home,
    staleTime: 30_000,
    refetchInterval: 5 * 60_000,
    select,
  })
}

export function useWeather() {
  return useQuery({
    queryKey: homeKeys.weather,
    queryFn: homeApi.weather,
    staleTime: 10 * 60_000,
    refetchInterval: 30 * 60_000,
  })
}

export function useDashboard(kind: DashboardKind, enabled = true) {
  return useQuery({
    queryKey: homeKeys.dashboard(kind),
    queryFn: () => homeApi.dashboard(kind),
    enabled,
  })
}

export function useSaveDashboard(kind: DashboardKind) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SaveDashboardInput }) =>
      homeApi.saveDashboard(id, input),
    onSuccess: (dashboard) => qc.setQueryData(homeKeys.dashboard(kind), dashboard),
  })
}
