import type { WidgetSize } from '@shared/schemas/dashboard'
import type { LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import type { z } from 'zod'

export type WidgetConfig = Record<string, unknown>

export type WidgetProps<C extends WidgetConfig = WidgetConfig> = {
  size: WidgetSize
  config: C
  instanceId: string
}

export type ConfigEditorProps<C extends WidgetConfig = WidgetConfig> = {
  config: C
  onChange: (config: C) => void
}

export type WidgetDefinition<C extends WidgetConfig = WidgetConfig> = {
  type: string
  title: string
  description: string
  group: string
  icon: LucideIcon
  sizes: readonly WidgetSize[]
  defaultSize: WidgetSize
  configSchema: z.ZodType<C>
  component: ComponentType<WidgetProps<C>>
  /** Edits the parts of the config that need a custom UI (e.g. picking a shopping list). */
  ConfigEditor?: ComponentType<ConfigEditorProps<C>>
  drawer?: string
  link?: string
}

const registry = new Map<string, WidgetDefinition>()

export function registerWidget<C extends WidgetConfig>(definition: WidgetDefinition<C>): void {
  registry.set(definition.type, definition as unknown as WidgetDefinition)
}

export function getWidget(type: string): WidgetDefinition | undefined {
  return registry.get(type)
}

export function listWidgets(): WidgetDefinition[] {
  return [...registry.values()]
}

export function parseWidgetConfig(definition: WidgetDefinition, raw: unknown): WidgetConfig {
  const parsed = definition.configSchema.safeParse(raw ?? {})
  if (parsed.success) return parsed.data
  const fallback = definition.configSchema.safeParse({})
  return fallback.success ? fallback.data : {}
}
