import { Suspense } from 'react'
import { Spinner } from '@/components/button'
import { Drawer } from '@/components/overlay'
import { useUi } from '@/stores/ui'
import { getDrawer } from './drawers'

export function DrawerHost() {
  const drawer = useUi((s) => s.drawer)
  const closeDrawer = useUi((s) => s.closeDrawer)
  const definition = drawer ? getDrawer(drawer.name) : undefined
  if (!definition) return null
  const Content = definition.component
  return (
    <Drawer open onOpenChange={(open) => !open && closeDrawer()} title={definition.title}>
      <Suspense
        fallback={
          <div className="flex justify-center py-10">
            <Spinner className="text-fg-subtle" />
          </div>
        }
      >
        <Content props={drawer?.props} />
      </Suspense>
    </Drawer>
  )
}
