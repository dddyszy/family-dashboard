import type { SaveDashboardInput } from '@shared/schemas/dashboard'
import type { HomeData } from '@shared/schemas/home'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { homeApi } from './api'

export const homeKeys = {
  home: ['home'] as const,
  weather: ['weather'] as const,
  dashboard: ['dashboard'] as const,
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

export function useDashboard() {
  return useQuery({ queryKey: homeKeys.dashboard, queryFn: homeApi.dashboard })
}

export function useSaveDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveDashboardInput) => homeApi.saveDashboard(input),
    onSuccess: (dashboard) => qc.setQueryData(homeKeys.dashboard, dashboard),
  })
}
