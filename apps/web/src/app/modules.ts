import { CalendarDays, LayoutGrid, type LucideIcon, Settings, ShoppingCart } from 'lucide-react'
import '@/modules/calendar'
import '@/modules/shopping'
import '@/widgets/builtin'

export type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean }

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '首页', icon: LayoutGrid, end: true },
  { to: '/calendar', label: '日程', icon: CalendarDays },
  { to: '/shopping', label: '购物清单', icon: ShoppingCart },
  { to: '/settings', label: '设置', icon: Settings },
]
