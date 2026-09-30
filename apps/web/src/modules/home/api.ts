import type { Dashboard, SaveDashboardInput } from '@shared/schemas/dashboard'
import type { HomeData, WeatherData } from '@shared/schemas/home'
import { api } from '@/lib/api'

export const homeApi = {
  home: () => api.get<HomeData>('/home'),
  weather: () => api.get<WeatherData>('/weather'),
  dashboard: () => api.get<Dashboard>('/dashboard'),
  saveDashboard: (input: SaveDashboardInput) => api.put<Dashboard>('/dashboard', input),
}
