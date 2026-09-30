import {
  Apple,
  Baby,
  Gift,
  Home,
  type LucideIcon,
  PawPrint,
  Pill,
  ShoppingBag,
  ShoppingCart,
  Sofa,
  Wrench,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  'shopping-cart': ShoppingCart,
  'shopping-bag': ShoppingBag,
  apple: Apple,
  pill: Pill,
  baby: Baby,
  home: Home,
  sofa: Sofa,
  wrench: Wrench,
  gift: Gift,
  paw: PawPrint,
}

export const LIST_ICONS = Object.keys(ICONS)

export function ListIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? ShoppingCart
  return <Icon className={className} />
}
