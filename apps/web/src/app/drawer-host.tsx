import { lazy, Suspense } from 'react'
import { Spinner } from '@/components/button'
import { useUi } from '@/stores/ui'
import { getDrawer } from './drawers'

// Dialog primitives are only downloaded the first time a drawer opens.
const Drawer = lazy(() => import('@/components/overlay').then((m) => ({ default: m.Drawer })))

export function DrawerHost() {
  const drawer = useUi((s) => s.drawer)
  const closeDrawer = useUi((s) => s.closeDrawer)
  const definition = drawer ? getDrawer(drawer.name) : undefined
  if (!definition) return null
  const Content = definition.component
  return (
    <Suspense fallback={null}>
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
    </Suspense>
  )
}
