import { DEFAULT_HOUSEHOLD_SETTINGS } from '@shared/schemas/settings'
import { LogOut } from 'lucide-react'
import { type ReactNode, Suspense } from 'react'
import { Link, Redirect, useLocation } from 'wouter'
import { Spinner } from '@/components/button'
import { Glass } from '@/components/glass'
import { Avatar } from '@/components/misc'
import { cn } from '@/lib/cn'
import { useAuthStatus, useCurrentUser, useLogout, useMe } from '@/modules/auth/queries'
import { CalendarEditorHost } from '@/modules/calendar/components/editor-host'
import { ReminderHost } from '@/modules/reminders/reminder-host'
import { useHousehold } from '@/modules/settings/queries'
import { resolveUserAppearance, useApplyAppearance } from './appearance'
import { DrawerHost } from './drawer-host'
import { NAV_ITEMS, type NavItem } from './modules'
import { RealtimeBridge } from './realtime-bridge'
import { StatusBar } from './status-bar'

export function FullScreenSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner className="size-7 text-fg-muted" />
    </div>
  )
}

function RedirectToAuth() {
  const status = useAuthStatus(true)
  if (status.isPending) return <FullScreenSpinner />
  return <Redirect to={status.data?.initialized === false ? '/setup' : '/login'} replace />
}

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe()
  if (!me.data) return me.isError ? <RedirectToAuth /> : <FullScreenSpinner />
  if (me.data.kind === 'anonymous') return <RedirectToAuth />
  if (me.data.kind === 'device') return <Redirect to="/kiosk" replace />
  return <SignedInShell>{children}</SignedInShell>
}

function isActive(item: NavItem, location: string): boolean {
  return item.end ? location === item.to : location.startsWith(item.to)
}

function SignedInShell({ children }: { children: ReactNode }) {
  const user = useCurrentUser()
  const household = useHousehold().data ?? DEFAULT_HOUSEHOLD_SETTINGS
  useApplyAppearance((now) => (user ? resolveUserAppearance(user.prefs, household, now) : null))

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <main className="safe-top min-w-0 flex-1 px-4 pt-5 pb-28 md:px-6 md:pb-8 lg:px-8">
        <Suspense fallback={<FullScreenSpinner />}>{children}</Suspense>
      </main>
      <TabBar />
      <DrawerHost />
      <CalendarEditorHost />
      <ReminderHost />
      <RealtimeBridge />
      <StatusBar />
    </div>
  )
}

function Sidebar() {
  const user = useCurrentUser()
  const logout = useLogout()
  const [location] = useLocation()
  return (
    <aside className="sticky top-0 hidden h-dvh shrink-0 p-3 md:block md:w-24 lg:w-64">
      <Glass refract className="flex h-full flex-col p-3">
        <div className="flex items-center gap-3 px-2 pt-2 pb-5 md:justify-center lg:justify-start">
          <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-accent text-lg font-bold text-accent-fg">
            家
          </span>
          <span className="hidden text-lg font-semibold lg:inline">家庭看板</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              href={item.to}
              aria-label={item.label}
              title={item.label}
              className={cn(
                'pressable flex items-center gap-3 rounded-2xl px-3 py-3 font-medium transition md:justify-center lg:justify-start',
                isActive(item, location)
                  ? 'bg-accent text-accent-fg shadow'
                  : 'text-fg-muted hover:bg-surface hover:text-fg',
              )}
            >
              <item.icon className="size-5 shrink-0" />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          ))}
        </nav>
        {user ? (
          <div className="flex items-center gap-2 rounded-2xl p-2 md:flex-col lg:flex-row">
            <Avatar user={user} size={36} />
            <div className="hidden min-w-0 flex-1 lg:block">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="text-xs text-fg-subtle">{user.role === 'admin' ? '管理员' : '成员'}</p>
            </div>
            <button
              type="button"
              onClick={() => logout.mutate()}
              className="rounded-full p-2 text-fg-muted hover:bg-surface hover:text-fg"
              aria-label="退出登录"
              title="退出登录"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        ) : null}
      </Glass>
    </aside>
  )
}

function TabBar() {
  const [location] = useLocation()
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 px-3 pb-3 md:hidden">
      <Glass refract className="flex justify-around rounded-[28px] px-2 py-1.5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item, location)
          return (
            <Link
              key={item.to}
              href={item.to}
              aria-label={item.label}
              title={item.label}
              className={cn(
                'pressable flex min-w-16 flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[11px] font-medium',
                active ? 'text-accent' : 'text-fg-muted',
              )}
            >
              <item.icon className="size-6" strokeWidth={active ? 2.2 : 1.8} />
              {item.label}
            </Link>
          )
        })}
      </Glass>
    </nav>
  )
}
