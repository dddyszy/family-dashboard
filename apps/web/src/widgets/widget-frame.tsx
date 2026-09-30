import type { WidgetSize } from '@shared/schemas/dashboard'
import { CircleAlert, Minus, SlidersHorizontal } from 'lucide-react'
import { Suspense } from 'react'
import { useNavigate } from 'react-router'
import { Spinner } from '@/components/button'
import { ErrorBoundary } from '@/components/error-boundary'
import { Glass } from '@/components/glass'
import { cn } from '@/lib/cn'
import { useUi } from '@/stores/ui'
import { ReadOnlyContext } from './read-only'
import { parseWidgetConfig, type WidgetDefinition } from './registry'

type Props = {
  definition: WidgetDefinition | undefined
  instanceId: string
  config: unknown
  size: WidgetSize
  editMode: boolean
  readOnly?: boolean
  onRemove?: () => void
  onResize?: (size: WidgetSize) => void
  onConfigure?: () => void
}

export function WidgetFrame({
  definition,
  instanceId,
  config,
  size,
  editMode,
  readOnly,
  onRemove,
  onResize,
  onConfigure,
}: Props) {
  const openDrawer = useUi((s) => s.openDrawer)
  const navigate = useNavigate()

  const activate = () => {
    if (editMode || !definition) return
    if (definition.drawer)
      openDrawer(definition.drawer, { readOnly, ...parseWidgetConfig(definition, config) })
    else if (definition.link && !readOnly) navigate(definition.link)
  }

  return (
    <div className={cn('group relative h-full', editMode && 'animate-jiggle')}>
      <Glass
        className={cn(
          'h-full overflow-hidden',
          !editMode && definition?.drawer && 'pressable cursor-pointer',
          editMode && 'cursor-grab active:cursor-grabbing',
        )}
        onClick={activate}
      >
        {definition ? (
          <ErrorBoundary fallback={<WidgetError />} resetKey={`${instanceId}:${size}`}>
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <Spinner className="text-fg-subtle" />
                </div>
              }
            >
              <ReadOnlyContext.Provider value={Boolean(readOnly)}>
                <definition.component
                  size={size}
                  config={parseWidgetConfig(definition, config)}
                  instanceId={instanceId}
                />
              </ReadOnlyContext.Provider>
            </Suspense>
          </ErrorBoundary>
        ) : (
          <WidgetError message="该卡片已不可用" />
        )}
      </Glass>
      {editMode ? (
        <>
          <button
            type="button"
            onClick={onRemove}
            className="no-drag absolute -top-2 -left-2 z-10 inline-flex size-7 items-center justify-center rounded-full bg-fg-muted text-white shadow-md backdrop-blur"
            aria-label="移除卡片"
          >
            <Minus className="size-4" strokeWidth={3} />
          </button>
          <div className="no-drag absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1">
            <div className="glass glass-strong flex items-center gap-0.5 rounded-full p-1">
              {definition?.sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onResize?.(s)}
                  className={cn(
                    'min-w-8 rounded-full px-2 py-1 text-xs font-semibold',
                    s === size ? 'bg-accent text-accent-fg' : 'text-fg-muted hover:text-fg',
                  )}
                  aria-label={`尺寸 ${s}`}
                >
                  {s}
                </button>
              ))}
              {definition?.ConfigEditor ? (
                <button
                  type="button"
                  onClick={onConfigure}
                  className="rounded-full p-1.5 text-fg-muted hover:text-fg"
                  aria-label="卡片设置"
                >
                  <SlidersHorizontal className="size-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function WidgetError({ message = '卡片加载失败' }: { message?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 p-3 text-center text-sm text-fg-muted">
      <CircleAlert className="size-5 text-warning" />
      {message}
    </div>
  )
}

/** Shared header row used by most widgets. */
export function WidgetHeader({
  icon: Icon,
  title,
  accent,
  trailing,
}: {
  icon: WidgetDefinition['icon']
  title: string
  accent?: string
  trailing?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-fg-muted uppercase">
      <Icon className="size-3.5" style={accent ? { color: accent } : undefined} />
      <span className="truncate">{title}</span>
      {trailing ? <span className="ml-auto normal-case">{trailing}</span> : null}
    </div>
  )
}
