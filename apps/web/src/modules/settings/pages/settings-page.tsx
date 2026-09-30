import { useState } from 'react'
import { Button } from '@/components/button'
import { Segmented } from '@/components/form'
import { PageHeader } from '@/components/misc'
import { useCurrentUser, useLogout } from '@/modules/auth/queries'
import { AppearanceSection } from '../components/appearance-section'
import { DataSection } from '../components/data-section'
import { DevicesSection } from '../components/devices-section'
import { HouseholdSection } from '../components/household-section'
import { MembersSection } from '../components/members-section'
import { ProfileSection } from '../components/profile-section'
import { ResetSection } from '../components/reset-section'

type Tab = 'profile' | 'appearance' | 'family' | 'kiosk' | 'data'

export function SettingsPage() {
  const user = useCurrentUser()
  const logout = useLogout()
  const [tab, setTab] = useState<Tab>('profile')
  if (!user) return null
  const isAdmin = user.role === 'admin'

  const tabs: Array<{ value: Tab; label: string }> = [
    { value: 'profile', label: '个人' },
    { value: 'appearance', label: '外观' },
    ...(isAdmin
      ? ([
          { value: 'family', label: '家庭' },
          { value: 'kiosk', label: '大屏' },
          { value: 'data', label: '数据' },
        ] as const)
      : []),
  ]

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="设置"
        actions={
          <Button variant="ghost" className="md:hidden" onClick={() => logout.mutate()}>
            退出登录
          </Button>
        }
      />
      <div className="mb-5 overflow-x-auto scrollbar-none">
        <Segmented value={tab} onChange={setTab} options={tabs} />
      </div>
      {tab === 'profile' ? <ProfileSection user={user} /> : null}
      {tab === 'appearance' ? <AppearanceSection user={user} /> : null}
      {tab === 'family' && isAdmin ? (
        <div className="flex flex-col gap-5">
          <MembersSection currentUserId={user.id} />
          <HouseholdSection />
        </div>
      ) : null}
      {tab === 'kiosk' && isAdmin ? <DevicesSection /> : null}
      {tab === 'data' && isAdmin ? (
        <div className="flex flex-col gap-5">
          <DataSection />
          <ResetSection />
        </div>
      ) : null}
    </div>
  )
}
