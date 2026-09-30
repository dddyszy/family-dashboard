import type { WidgetInstance } from '@shared/schemas/dashboard'
import { useState } from 'react'
import { Button } from '@/components/button'
import { Modal } from '@/components/overlay'
import { getWidget, parseWidgetConfig, type WidgetConfig } from '@/widgets/registry'

export function WidgetConfigModal({
  widget,
  onClose,
  onSave,
}: {
  widget: WidgetInstance
  onClose: () => void
  onSave: (config: WidgetConfig) => void
}) {
  const definition = getWidget(widget.type)
  const [config, setConfig] = useState<WidgetConfig>(() =>
    definition ? parseWidgetConfig(definition, widget.config) : {},
  )
  const Editor = definition?.ConfigEditor
  if (!definition || !Editor) return null

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={`${definition.title} · 设置`}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button
            variant="primary"
            onClick={() => {
              onSave(parseWidgetConfig(definition, config))
              onClose()
            }}
          >
            完成
          </Button>
        </>
      }
    >
      <Editor config={config} onChange={setConfig} />
    </Modal>
  )
}
