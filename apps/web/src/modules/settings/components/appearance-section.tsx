import type { Me, UserPrefs } from '@shared/schemas/users'
import type { ReactNode } from 'react'
import { Switch } from '@/components/form'
import { Glass } from '@/components/glass'
import { Section } from '@/components/misc'
import { errorMessage } from '@/lib/api'
import { useUpdateMe } from '@/modules/auth/queries'
import { toast } from '@/stores/ui'
import { useHouseholdSettings } from '../queries'
import { ThemePicker, WallpaperPicker } from './theme-picker'

function Row({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-fg-muted">{description}</p>
      </div>
      {children}
    </div>
  )
}

export function AppearanceSection({ user }: { user: Me }) {
  const updateMe = useUpdateMe()
  const household = useHouseholdSettings()
  const prefs = user.prefs
  const save = (patch: Partial<UserPrefs>) =>
    updateMe.mutate({ prefs: patch }, { onError: (err) => toast.error(errorMessage(err)) })

  return (
    <div className="flex flex-col gap-5">
      <Glass className="p-5">
        <Section title="主题">
          <ThemePicker value={prefs.theme} onChange={(theme) => save({ theme })} />
        </Section>
      </Glass>
      <Glass className="p-5">
        <Section title="壁纸" description="液态玻璃主题会透出壁纸的色彩">
          <WallpaperPicker value={prefs.wallpaper} onChange={(wallpaper) => save({ wallpaper })} />
        </Section>
      </Glass>
      <Glass className="p-5">
        <Section title="显示">
          <div className="divide-y divide-line">
            <Row
              title="夜间自动深色"
              description={`浅色玻璃主题在 ${household.darkWindow.start} - ${household.darkWindow.end} 自动切换为深色`}
            >
              <Switch
                label="夜间自动深色"
                checked={prefs.autoDark}
                onChange={(autoDark) => save({ autoDark })}
              />
            </Row>
            <Row title="性能模式" description="关闭模糊效果，适合配置较低的平板">
              <Switch
                label="性能模式"
                checked={prefs.perfMode}
                onChange={(perfMode) => save({ perfMode })}
              />
            </Row>
            <Row
              title="折射效果（实验）"
              description="在 Chrome 内核浏览器中为侧边栏和抽屉增加玻璃折射"
            >
              <Switch
                label="折射效果"
                checked={prefs.refraction}
                onChange={(refraction) => save({ refraction })}
              />
            </Row>
          </div>
        </Section>
      </Glass>
    </div>
  )
}
