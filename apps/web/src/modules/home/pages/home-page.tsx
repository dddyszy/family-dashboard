import { appendToLayouts, removeFromLayouts, resizeInLayouts } from '@shared/layout'
import type { Layouts, WidgetInstance } from '@shared/schemas/dashboard'
import { getZonedParts } from '@shared/time'
import { Check, Pencil, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/button'
import { Segmented } from '@/components/form'
import { errorMessage } from '@/lib/api'
import { formatFullDate } from '@/lib/time'
import { useNow } from '@/lib/use-now'
import { useCurrentUser } from '@/modules/auth/queries'
import { useTimeZone } from '@/modules/settings/queries'
import { toast, useUi } from '@/stores/ui'
import { parseWidgetConfig } from '@/widgets/registry'
import type { DashboardKind } from '../api'
import { DashboardGrid } from '../components/dashboard-grid'
import { WidgetConfigModal } from '../components/widget-config-modal'
import { WidgetGallery } from '../components/widget-gallery'
import { useDashboard, useHome, useSaveDashboard } from '../queries'

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
  const [kind, setKind] = useState<DashboardKind>('mine')
  const dashboard = useDashboard(kind)
  const save = useSaveDashboard(kind)
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
    save.mutate(
      { id: dashboard.data.id, input: draft },
      {
        onSuccess: () => {
          setDraft(null)
          setEditMode(false)
          toast.success('布局已保存')
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  const current: Draft | undefined = draft ?? dashboard.data
  const hour = getZonedParts(now, timeZone).hour
  const isAdmin = user?.role === 'admin'

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
          {isAdmin && !editMode ? (
            <Segmented
              value={kind}
              onChange={setKind}
              options={[
                { value: 'mine', label: '我的首页' },
                { value: 'family', label: '家庭大屏' },
              ]}
            />
          ) : null}
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

      <WidgetGallery
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        onAdd={(definition) => {
          const id = crypto.randomUUID()
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
        }}
      />
      {configuring && draft
        ? (() => {
            const widget = draft.widgets.find((w) => w.id === configuring)
            return widget ? (
              <WidgetConfigModal
                widget={widget}
                onClose={() => setConfiguring(null)}
                onSave={(config) =>
                  setDraft((d) =>
                    d
                      ? {
                          ...d,
                          widgets: d.widgets.map((w) =>
                            w.id === configuring ? { ...w, config } : w,
                          ),
                        }
                      : d,
                  )
                }
              />
            ) : null
          })()
        : null}
    </div>
  )
}
