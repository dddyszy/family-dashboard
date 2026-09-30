import type { EditScope } from '@shared/schemas/calendar'
import { Button } from '@/components/button'
import { ConfirmDialog } from '@/components/overlay'

export function ScopeDialog({
  action,
  onChoose,
  onCancel,
}: {
  action: 'edit' | 'delete'
  onChoose: (scope: EditScope) => void
  onCancel: () => void
}) {
  const verb = action === 'edit' ? '修改' : '删除'
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onCancel()}
      title={`${verb}重复日程`}
      description={`这是一个重复日程，要${verb}哪些？`}
      actions={
        <>
          <Button
            variant={action === 'delete' ? 'danger' : 'primary'}
            onClick={() => onChoose('this')}
          >
            仅此一次
          </Button>
          <Button onClick={() => onChoose('following')}>此次及以后</Button>
          <Button onClick={() => onChoose('all')}>全部</Button>
          <Button variant="ghost" onClick={onCancel}>
            取消
          </Button>
        </>
      }
    />
  )
}
