import { Cron } from 'croner'
import type { Deps } from '../lib/context'
import { purgeExpiredSessions } from '../services/auth'
import { runBackup } from '../services/backup'
import { expireStaleReminders, fireDueReminders, rollReminderHorizon } from '../services/reminders'
import { getTimeZone } from '../services/settings'

export function startJobs(deps: Deps): Cron[] {
  const timezone = getTimeZone(deps)
  const safe = (name: string, fn: () => unknown) => async () => {
    try {
      await fn()
    } catch (error) {
      console.error(`定时任务「${name}」执行失败`, error)
    }
  }

  // Catch up after a restart: drop alerts older than a day, deliver the rest right away.
  void safe('启动补发提醒', () => {
    expireStaleReminders(deps)
    rollReminderHorizon(deps)
    fireDueReminders(deps)
  })()

  return [
    new Cron(
      '* * * * *',
      { timezone, protect: true },
      safe('触发提醒', () => fireDueReminders(deps)),
    ),
    new Cron(
      '0 3 * * *',
      { timezone },
      safe('滚动生成提醒', () => rollReminderHorizon(deps)),
    ),
    new Cron(
      '0 2 * * *',
      { timezone },
      safe('自动备份', () => runBackup(deps)),
    ),
    new Cron(
      '30 4 * * *',
      { timezone },
      safe('清理过期会话', () => purgeExpiredSessions(deps)),
    ),
  ]
}
