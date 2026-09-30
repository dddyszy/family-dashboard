import type { Dashboard, SaveDashboardInput } from '@shared/schemas/dashboard'
import type { HomeData, WeatherData } from '@shared/schemas/home'
import { api } from '@/lib/api'

export type DashboardKind = 'mine' | 'family'

export const homeApi = {
  home: () => api.get<HomeData>('/home'),
  weather: () => api.get<WeatherData>('/weather'),
  dashboard: (kind: DashboardKind) => api.get<Dashboard>(`/dashboards/${kind}`),
  saveDashboard: (id: string, input: SaveDashboardInput) =>
    api.put<Dashboard>(`/dashboards/${id}`, input),
}
