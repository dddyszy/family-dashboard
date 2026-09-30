import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import { LoginPage } from '@/modules/auth/pages/login-page'
import { SetupPage } from '@/modules/auth/pages/setup-page'
import { HomePage } from '@/modules/home/pages/home-page'
import { AppShell } from './app-shell'

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

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/setup', element: <SetupPage /> },
  { path: '/kiosk', element: <KioskPage /> },
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'shopping', element: <ShoppingPage /> },
      { path: 'shopping/:listId', element: <ShoppingPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
