import { Cron } from 'croner'
import type { Deps } from '../lib/context'
import { purgeExpiredSessions } from '../services/auth'
import { getTimeZone } from '../services/settings'

export function startJobs(deps: Deps): Cron[] {
  const timezone = getTimeZone(deps)
  const safe = (name: string, fn: () => void | Promise<void>) => async () => {
    try {
      await fn()
    } catch (error) {
      console.error(`定时任务「${name}」执行失败`, error)
    }
  }
  return [
    new Cron(
      '30 4 * * *',
      { timezone },
      safe('清理过期会话', () => purgeExpiredSessions(deps)),
    ),
  ]
}
