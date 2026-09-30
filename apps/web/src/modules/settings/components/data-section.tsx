import { Database, Download, FileJson } from 'lucide-react'
import { Button } from '@/components/button'
import { Glass } from '@/components/glass'
import { EmptyState, Section } from '@/components/misc'
import { errorMessage } from '@/lib/api'
import { toast } from '@/stores/ui'
import { useBackupNow, useBackups } from '../queries'

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function DataSection() {
  const backups = useBackups(true)
  const backupNow = useBackupNow()

  return (
    <Glass className="p-5">
      <Section
        title="备份与导出"
        description="每天凌晨 2 点自动备份，保留最近 7 份"
        actions={
          <div className="flex gap-2">
            <Button size="sm" onClick={() => window.open('/api/export', '_blank')}>
              <FileJson className="size-4" />
              导出 JSON
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={backupNow.isPending}
              onClick={() =>
                backupNow.mutate(undefined, {
                  onSuccess: () => toast.success('备份完成'),
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              立即备份
            </Button>
          </div>
        }
      >
        {backups.data?.length ? (
          <ul className="divide-y divide-line">
            {backups.data.map((b) => (
              <li key={b.name} className="flex items-center gap-3 py-3">
                <Database className="size-5 shrink-0 text-fg-muted" />
                <div className="min-w-0 flex-1">
                  <p className="break-all font-mono text-sm">{b.name}</p>
                  <p className="text-xs text-fg-muted">
                    {new Date(b.createdAt).toLocaleString('zh-CN')} · {formatSize(b.size)}
                  </p>
                </div>
                <a
                  href={`/api/backups/${encodeURIComponent(b.name)}`}
                  className="rounded-full p-2 text-fg-muted hover:bg-surface hover:text-fg"
                  aria-label={`下载 ${b.name}`}
                  download
                >
                  <Download className="size-4" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Database} title="还没有备份" />
        )}
      </Section>
    </Glass>
  )
}
