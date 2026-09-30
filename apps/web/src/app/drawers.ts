import type { ComponentType } from 'react'

export type DrawerDefinition = {
  name: string
  title: string
  component: ComponentType<{ props?: Record<string, unknown> }>
}

const drawers = new Map<string, DrawerDefinition>()

export function registerDrawer(definition: DrawerDefinition): void {
  drawers.set(definition.name, definition)
}

export function getDrawer(name: string): DrawerDefinition | undefined {
  return drawers.get(name)
}
