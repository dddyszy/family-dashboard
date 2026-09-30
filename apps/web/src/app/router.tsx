import { lazy, Suspense } from 'react'
import { Redirect, Route, Switch } from 'wouter'
import { LoginPage } from '@/modules/auth/pages/login-page'
import { SetupPage } from '@/modules/auth/pages/setup-page'
import { HomePage } from '@/modules/home/pages/home-page'
import { AppShell, FullScreenSpinner } from './app-shell'

const CalendarPage = lazy(() =>
  import('@/modules/calendar/pages/calendar-page').then((m) => ({ default: m.CalendarPage })),
)
const ShoppingPage = lazy(() =>
  import('@/modules/shopping/pages/shopping-page').then((m) => ({ default: m.ShoppingPage })),
)
const SettingsPage = lazy(() =>
  import('@/modules/settings/pages/settings-page').then((m) => ({ default: m.SettingsPage })),
)
const KioskPage = lazy(() =>
  import('@/modules/kiosk/pages/kiosk-page').then((m) => ({ default: m.KioskPage })),
)

export function AppRoutes() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/setup" component={SetupPage} />
      <Route path="/kiosk">
        <Suspense fallback={<FullScreenSpinner />}>
          <KioskPage />
        </Suspense>
      </Route>
      <Route>
        <AppShell>
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/calendar" component={CalendarPage} />
            <Route path="/shopping/:listId?" component={ShoppingPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route>
              <Redirect to="/" replace />
            </Route>
          </Switch>
        </AppShell>
      </Route>
    </Switch>
  )
}
