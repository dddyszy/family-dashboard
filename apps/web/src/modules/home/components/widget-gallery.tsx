import { Plus } from 'lucide-react'
import { Modal } from '@/components/overlay'
import { listWidgets, type WidgetDefinition } from '@/widgets/registry'

export function WidgetGallery({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (definition: WidgetDefinition) => void
}) {
  const groups = new Map<string, WidgetDefinition[]>()
  for (const def of listWidgets()) {
    groups.set(def.group, [...(groups.get(def.group) ?? []), def])
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="添加卡片" className="sm:max-w-2xl">
      <div className="flex flex-col gap-6">
        {[...groups].map(([group, defs]) => (
          <section key={group}>
            <h3 className="mb-2 text-sm font-semibold text-fg-muted">{group}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {defs.map((def) => (
                <button
                  key={def.type}
                  type="button"
                  onClick={() => onAdd(def)}
                  className="pressable flex items-start gap-3 rounded-2xl bg-surface p-3 text-left hover:bg-surface-hover"
                >
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <def.icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{def.title}</span>
                    <span className="block text-sm text-fg-muted">{def.description}</span>
                    <span className="mt-1 block text-xs text-fg-subtle">
                      尺寸：{def.sizes.join(' / ')}
                    </span>
                  </span>
                  <Plus className="mt-1 size-4 text-accent" />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  )
}
