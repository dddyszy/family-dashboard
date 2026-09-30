import { DEFAULT_TIMEZONE } from '@shared/constants'
import {
  DEFAULT_HOUSEHOLD_SETTINGS,
  type HouseholdSettings,
  type UpdateSettingsInput,
} from '@shared/schemas/settings'
import type { CreateUserInput, PublicUser, UpdateUserInput } from '@shared/schemas/users'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useMe } from '@/modules/auth/queries'
import { settingsApi } from './api'

export const settingsKeys = {
  household: ['settings'] as const,
  members: ['members'] as const,
  devices: ['devices'] as const,
  backups: ['backups'] as const,
}

function useSignedIn(): boolean {
  const { data } = useMe()
  return data?.kind === 'user' || data?.kind === 'device'
}

export function useHousehold() {
  const enabled = useSignedIn()
  return useQuery({
    queryKey: settingsKeys.household,
    queryFn: settingsApi.household,
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useHouseholdSettings(): HouseholdSettings {
  return useHousehold().data ?? DEFAULT_HOUSEHOLD_SETTINGS
}

export function useTimeZone(): string {
  return useHousehold().data?.timezone ?? DEFAULT_TIMEZONE
}

export function useUpdateHousehold() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateSettingsInput) => settingsApi.updateHousehold(input),
    onSuccess: (data) => qc.setQueryData(settingsKeys.household, data),
  })
}

export function useMembers() {
  const enabled = useSignedIn()
  return useQuery({
    queryKey: settingsKeys.members,
    queryFn: settingsApi.members,
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useMemberMap(): Map<string, PublicUser> {
  const { data } = useMembers()
  return useMemo(() => new Map((data ?? []).map((m) => [m.id, m])), [data])
}

export function useCreateMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateUserInput) => settingsApi.createMember(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.members }),
  })
}

export function useUpdateMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      settingsApi.updateMember(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.members }),
  })
}

export function useDeleteMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => settingsApi.deleteMember(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.members }),
  })
}

export function useDevices(enabled: boolean) {
  return useQuery({ queryKey: settingsKeys.devices, queryFn: settingsApi.devices, enabled })
}

export function useRevokeDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => settingsApi.revokeDevice(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.devices }),
  })
}

export function useBackups(enabled: boolean) {
  return useQuery({ queryKey: settingsKeys.backups, queryFn: settingsApi.backups, enabled })
}

export function useBackupNow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: settingsApi.backupNow,
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.backups }),
  })
}
