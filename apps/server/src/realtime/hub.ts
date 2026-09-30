import type { RealtimeEventName, RealtimeEvents } from '@shared/realtime'
import type { Viewer } from '../lib/visibility'

export type Audience = { kind: 'family' } | { kind: 'users'; userIds: readonly string[] }

type Send = (event: string, data: string) => void

type Client = { id: number; viewer: Viewer; deviceId: string | null; send: Send; close: () => void }

export type StreamOptions = { deviceId?: string | null; close?: () => void }

export type DisconnectTarget = { userId: string } | { deviceId: string }

export class RealtimeHub {
  private clients = new Map<number, Client>()
  private nextId = 1

  add(viewer: Viewer, send: Send, options: StreamOptions = {}): () => void {
    const id = this.nextId++
    const { deviceId = null, close = () => {} } = options
    this.clients.set(id, { id, viewer, deviceId, send, close })
    return () => this.clients.delete(id)
  }

  /** Ends the streams of a deleted user or revoked device right away. */
  disconnect(target: DisconnectTarget): void {
    for (const client of [...this.clients.values()]) {
      const hit =
        'userId' in target
          ? client.viewer.kind === 'user' && client.viewer.userId === target.userId
          : client.deviceId === target.deviceId
      if (!hit) continue
      this.clients.delete(client.id)
      client.close()
    }
  }

  get size(): number {
    return this.clients.size
  }

  broadcast<K extends RealtimeEventName>(
    event: K,
    data: RealtimeEvents[K],
    audience: Audience,
  ): void {
    const payload = JSON.stringify(data)
    for (const client of this.clients.values()) {
      if (!matches(client.viewer, audience)) continue
      try {
        client.send(event, payload)
      } catch {
        this.clients.delete(client.id)
      }
    }
  }

  /** Sends only to kiosk devices, e.g. family reminders that were already delivered to users. */
  broadcastToDevices<K extends RealtimeEventName>(event: K, data: RealtimeEvents[K]): void {
    const payload = JSON.stringify(data)
    for (const client of this.clients.values()) {
      if (client.viewer.kind !== 'device') continue
      try {
        client.send(event, payload)
      } catch {
        this.clients.delete(client.id)
      }
    }
  }
}

function matches(viewer: Viewer, audience: Audience): boolean {
  if (audience.kind === 'family') return true
  return viewer.kind === 'user' && audience.userIds.includes(viewer.userId)
}
