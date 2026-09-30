import type { ResetInput, ResetResult } from '@shared/schemas/admin'
import type { HouseholdSettings, UpdateSettingsInput } from '@shared/schemas/settings'
import type { CreateUserInput, PublicUser, UpdateUserInput } from '@shared/schemas/users'
import { api } from '@/lib/api'

export type DeviceSummary = {
  id: string
  name: string
  lastSeenAt: number | null
  createdAt: number
}
export type BackupFile = { name: string; size: number; createdAt: number }

export const settingsApi = {
  household: () => api.get<HouseholdSettings>('/settings'),
  updateHousehold: (input: UpdateSettingsInput) => api.patch<HouseholdSettings>('/settings', input),
  members: () => api.get<PublicUser[]>('/users'),
  createMember: (input: CreateUserInput) => api.post<PublicUser>('/users', input),
  updateMember: (id: string, input: UpdateUserInput) =>
    api.patch<PublicUser>(`/users/${id}`, input),
  deleteMember: (id: string) => api.delete<{ ok: true }>(`/users/${id}`),
  devices: () => api.get<DeviceSummary[]>('/devices'),
  pairingCode: () => api.post<{ code: string; expiresAt: number }>('/devices/pairing-code'),
  revokeDevice: (id: string) => api.delete<{ ok: true }>(`/devices/${id}`),
  pair: (code: string, name: string) =>
    api.post<{ id: string; name: string }>('/devices/pair', { code, name }),
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<{ url: string }>('/uploads', form)
  },
  reset: (input: ResetInput) => api.post<ResetResult>('/admin/reset', input),
  backups: () => api.get<BackupFile[]>('/backups'),
  backupNow: () => api.post<BackupFile>('/backups'),
}
