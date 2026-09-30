import type { EventInstance } from './calendar'
import type { ShoppingItem, ShoppingList } from './shopping'
import type { Todo } from './todos'
import type { PublicUser } from './users'

export type HomeData = {
  members: PublicUser[]
  calendar: {
    rangeStart: number
    rangeEnd: number
    instances: EventInstance[]
    todos: Todo[]
  }
  shopping: {
    lists: ShoppingList[]
    pendingItems: Record<string, ShoppingItem[]>
  }
}

export type WeatherData = {
  location: string
  updatedAt: number
  current: {
    temperature: number
    apparentTemperature: number
    humidity: number
    weatherCode: number
    isDay: boolean
  }
  daily: Array<{ date: string; weatherCode: number; max: number; min: number }>
}
