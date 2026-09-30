import { lazy, Suspense } from 'react'
import { Redirect, Route, Switch } from 'wouter'
import { AuthGate } from '@/modules/auth/components/auth-gate'
import { LoginPage } from '@/modules/auth/pages/login-page'
import { SetupPage } from '@/modules/auth/pages/setup-page'
import { HomePage } from '@/modules/home/pages/home-page'
import { AppShell, FullScreenSpinner } from './app-shell'

const RegisterPage = lazy(() =>
  import('@/modules/auth/pages/register-page').then((m) => ({ default: m.RegisterPage })),
)
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
      <Route path="/login">
        <AuthGate mode="sign-in">
          <LoginPage />
        </AuthGate>
      </Route>
      <Route path="/setup">
        <AuthGate mode="setup">
          <SetupPage />
        </AuthGate>
      </Route>
      <Route path="/register">
        <AuthGate mode="sign-in">
          <Suspense fallback={<FullScreenSpinner />}>
            <RegisterPage />
          </Suspense>
        </AuthGate>
      </Route>
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
