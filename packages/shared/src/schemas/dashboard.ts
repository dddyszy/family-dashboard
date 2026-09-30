import { z } from 'zod'

export const WIDGET_SIZES = ['S', 'M', 'L', 'XL'] as const
export type WidgetSize = (typeof WIDGET_SIZES)[number]

export const WIDGET_SIZE_DIMS: Record<WidgetSize, { w: number; h: number }> = {
  S: { w: 2, h: 2 },
  M: { w: 4, h: 2 },
  L: { w: 4, h: 4 },
  XL: { w: 4, h: 6 },
}

export const BREAKPOINTS = ['lg', 'md', 'sm'] as const
export type BreakpointName = (typeof BREAKPOINTS)[number]

export const BREAKPOINT_WIDTHS: Record<BreakpointName, number> = { lg: 1200, md: 768, sm: 0 }
export const BREAKPOINT_COLS: Record<BreakpointName, number> = { lg: 12, md: 8, sm: 4 }

export const layoutItemSchema = z.object({
  i: z.string().min(1).max(64),
  x: z.number().int().min(0).max(100),
  y: z.number().int().min(0).max(10000),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(12),
})
export type LayoutItem = z.infer<typeof layoutItemSchema>

export const layoutsSchema = z.object({
  lg: z.array(layoutItemSchema).max(60).default([]),
  md: z.array(layoutItemSchema).max(60).default([]),
  sm: z.array(layoutItemSchema).max(60).default([]),
})
export type Layouts = z.infer<typeof layoutsSchema>

export const widgetInstanceSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.string().min(1).max(64),
  config: z.record(z.string(), z.unknown()).default({}),
})
export type WidgetInstance = z.infer<typeof widgetInstanceSchema>

export type Dashboard = {
  id: string
  userId: string | null
  layouts: Layouts
  widgets: WidgetInstance[]
  updatedAt: number
}

export const saveDashboardInput = z.object({
  layouts: layoutsSchema,
  widgets: z.array(widgetInstanceSchema).max(60),
})
export type SaveDashboardInput = z.infer<typeof saveDashboardInput>
