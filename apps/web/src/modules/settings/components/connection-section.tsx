import { Glass } from '@/components/glass'
import { Section } from '@/components/misc'
import { browserCapabilities } from '@/lib/browser-capabilities'
import { usePwa } from '@/pwa/register'

export function ConnectionSection() {
  const capabilities = browserCapabilities()
  const status = usePwa((state) => state.status)
  const connection =
    window.location.protocol === 'https:'
      ? 'HTTPS 访问'
      : capabilities.secure
        ? '本机安全环境（HTTP）'
        : 'HTTP 访问'
  const offline =
    capabilities.offline === 'https-required'
      ? '需要 HTTPS 才能在断网后重新打开看板。当前页面断网后可继续查看已加载的数据，恢复网络后才能修改。'
      : capabilities.offline === 'unsupported'
        ? '当前浏览器不支持离线打开，请保持网络连接。'
        : status === 'error'
          ? '离线功能启用失败，请检查网络和浏览器设置后刷新重试。在线功能仍可使用。'
          : status === 'development'
            ? '开发预览未启用离线功能，生产构建后可使用。'
            : status === 'ready'
              ? '已启用，可离线打开已缓存的页面并查看缓存数据；修改和实时同步需要网络。'
              : '正在准备离线功能，请保持网络连接。'

  return (
    <Glass className="p-5">
      <Section
        title="连接与浏览器功能"
        description={`${connection}：登录、日程、购物、卡片编辑和实时同步均可使用。`}
      >
        <dl className="flex flex-col gap-4 text-sm">
          <div>
            <dt className="font-medium">离线打开</dt>
            <dd className="mt-1 text-fg-muted">{offline}</dd>
          </div>
          <div>
            <dt className="font-medium">安装到桌面</dt>
            <dd className="mt-1 text-fg-muted">
              {capabilities.secure
                ? '可在支持的浏览器菜单中选择安装应用或添加到主屏幕；入口和支持情况因浏览器而异。'
                : '完整的应用安装体验需要 HTTPS 和浏览器支持。HTTP 下仍可创建书签或浏览器提供的桌面快捷方式。'}
            </dd>
          </div>
          <div>
            <dt className="font-medium">屏幕常亮</dt>
            <dd className="mt-1 text-fg-muted">
              {capabilities.wakeLock === 'https-required'
                ? '自动常亮需要 HTTPS。大屏和超市模式仍可使用，可在设备系统设置中关闭自动锁屏。'
                : capabilities.wakeLock === 'unsupported'
                  ? '当前浏览器不支持自动常亮，可在设备系统设置中关闭自动锁屏。'
                  : '大屏和超市模式会尝试保持屏幕常亮；页面切到后台或系统省电时可能暂停。'}
            </dd>
          </div>
        </dl>
        {!capabilities.secure ? (
          <p className="text-sm text-fg-muted">
            需要以上增强功能时，请通过管理员配置好的 HTTPS 地址访问；无需重建账号和数据。
          </p>
        ) : null}
      </Section>
    </Glass>
  )
}
