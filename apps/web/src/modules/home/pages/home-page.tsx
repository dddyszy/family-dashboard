import { appendToLayouts, pruneLayouts, removeFromLayouts, resizeInLayouts } from '@shared/layout'
import type { Layouts, WidgetInstance } from '@shared/schemas/dashboard'
import { getZonedParts } from '@shared/time'
import { Check, Pencil, Plus } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Button } from '@/components/button'
import { errorMessage } from '@/lib/api'
import { formatFullDate } from '@/lib/time'
import { useNow } from '@/lib/use-now'
import { useCurrentUser } from '@/modules/auth/queries'
import { useTimeZone } from '@/modules/settings/queries'
import { toast, useUi } from '@/stores/ui'
import { parseWidgetConfig, type WidgetDefinition } from '@/widgets/registry'
import { createWidgetId } from '@/widgets/widget-id'
import { DashboardGrid } from '../components/dashboard-grid'
import { useDashboard, useHome, useSaveDashboard } from '../queries'

const WidgetGallery = lazy(() =>
  import('../components/widget-gallery').then((m) => ({ default: m.WidgetGallery })),
)
const WidgetConfigModal = lazy(() =>
  import('../components/widget-config-modal').then((m) => ({ default: m.WidgetConfigModal })),
)

type Draft = { layouts: Layouts; widgets: WidgetInstance[] }

function greeting(hour: number): string {
  if (hour < 6) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

export function HomePage() {
  const user = useCurrentUser()
  const timeZone = useTimeZone()
  const now = useNow(60_000)
  const dashboard = useDashboard()
  const save = useSaveDashboard()
  useHome()
  const { editMode, setEditMode, galleryOpen, setGalleryOpen } = useUi()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [configuring, setConfiguring] = useState<string | null>(null)

  useEffect(() => () => setEditMode(false), [setEditMode])

  const startEditing = () => {
    if (!dashboard.data) return
    setDraft({ layouts: dashboard.data.layouts, widgets: dashboard.data.widgets })
    setEditMode(true)
  }

  const cancel = () => {
    setDraft(null)
    setEditMode(false)
  }

  const finish = () => {
    if (!draft || !dashboard.data) return
    const layouts = pruneLayouts(
      draft.layouts,
      draft.widgets.map((w) => w.id),
    )
    save.mutate(
      { ...draft, layouts },
      {
        onSuccess: () => {
          setDraft(null)
          setEditMode(false)
          toast.success('布局已保存，全家看到的都会更新')
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  const addWidget = (definition: WidgetDefinition) => {
    const id = createWidgetId()
    setDraft((d) =>
      d
        ? {
            layouts: appendToLayouts(d.layouts, id, definition.defaultSize),
            widgets: [
              ...d.widgets,
              { id, type: definition.type, config: parseWidgetConfig(definition, {}) },
            ],
          }
        : d,
    )
    setGalleryOpen(false)
    if (definition.ConfigEditor) setConfiguring(id)
  }

  const configuringWidget = configuring
    ? draft?.widgets.find((w) => w.id === configuring)
    : undefined
  const current: Draft | undefined = draft ?? dashboard.data
  const hour = getZonedParts(now, timeZone).hour

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-fg-muted">{formatFullDate(now, timeZone)}</p>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {greeting(hour)}
            {user ? `，${user.name}` : ''}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editMode ? (
            <>
              <Button onClick={() => setGalleryOpen(true)}>
                <Plus className="size-4" />
                添加卡片
              </Button>
              <Button variant="ghost" onClick={cancel}>
                取消
              </Button>
              <Button variant="primary" onClick={finish} loading={save.isPending}>
                <Check className="size-4" />
                完成
              </Button>
            </>
          ) : (
            <Button onClick={startEditing} disabled={!dashboard.data}>
              <Pencil className="size-4" />
              编辑
            </Button>
          )}
        </div>
      </div>

      {current ? (
        <DashboardGrid
          layouts={current.layouts}
          widgets={current.widgets}
          editMode={editMode}
          onLayoutsChange={(layouts) => setDraft((d) => (d ? { ...d, layouts } : d))}
          onRemove={(id) =>
            setDraft((d) =>
              d
                ? {
                    layouts: removeFromLayouts(d.layouts, id),
                    widgets: d.widgets.filter((w) => w.id !== id),
                  }
                : d,
            )
          }
          onResize={(id, size) =>
            setDraft((d) => (d ? { ...d, layouts: resizeInLayouts(d.layouts, id, size) } : d))
          }
          onConfigure={setConfiguring}
        />
      ) : null}

      <Suspense fallback={null}>
        {galleryOpen ? (
          <WidgetGallery open onOpenChange={setGalleryOpen} onAdd={addWidget} />
        ) : null}
        {configuringWidget ? (
          <WidgetConfigModal
            widget={configuringWidget}
            onClose={() => setConfiguring(null)}
            onSave={(config) =>
              setDraft((d) =>
                d
                  ? {
                      ...d,
                      widgets: d.widgets.map((w) =>
                        w.id === configuringWidget.id ? { ...w, config } : w,
                      ),
                    }
                  : d,
              )
            }
          />
        ) : null}
      </Suspense>
    </div>
  )
}
