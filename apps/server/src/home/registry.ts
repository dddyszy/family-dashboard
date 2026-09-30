import type { HomeData } from '@shared/schemas/home'
import type { Deps } from '../lib/context'
import type { Viewer } from '../lib/visibility'

export type HomeContext = { deps: Deps; viewer: Viewer }

type Contributor<K extends keyof HomeData> = (ctx: HomeContext) => HomeData[K]

const contributors = new Map<keyof HomeData, Contributor<keyof HomeData>>()

/** Each module registers one function; `/api/home` calls them all and merges the results. */
export function registerHomeContributor<K extends keyof HomeData>(
  key: K,
  fn: Contributor<K>,
): void {
  contributors.set(key, fn as Contributor<keyof HomeData>)
}

export function buildHome(ctx: HomeContext): HomeData {
  const result: Partial<HomeData> = {}
  for (const [key, fn] of contributors) {
    ;(result as Record<string, unknown>)[key] = fn(ctx)
  }
  return result as HomeData
}
