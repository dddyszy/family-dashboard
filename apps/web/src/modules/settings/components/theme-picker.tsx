import { THEME_LABELS, THEMES, type Theme, WALLPAPER_LABELS, WALLPAPERS } from '@shared/constants'
import { Check, ImagePlus } from 'lucide-react'
import { useRef, useState } from 'react'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/cn'
import { toast } from '@/stores/ui'
import { settingsApi } from '../api'

const THEME_SWATCHES: Record<Theme, string> = {
  'liquid-glass-light': 'linear-gradient(135deg, #c7d8ff, #f5d0fe)',
  'liquid-glass-dark': 'linear-gradient(135deg, #1e293b, #4c1d95)',
  classic: 'linear-gradient(135deg, #eef0f5, #ffffff)',
  minimal: 'linear-gradient(135deg, #fafafa, #e5e5e5)',
  'wall-display': 'linear-gradient(135deg, #000000, #1c1c21)',
}

export function ThemePicker({
  value,
  onChange,
}: {
  value: Theme
  onChange: (theme: Theme) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {THEMES.map((theme) => (
        <button
          key={theme}
          type="button"
          onClick={() => onChange(theme)}
          aria-pressed={value === theme}
          className={cn(
            'pressable flex flex-col gap-2 rounded-2xl p-2 text-left text-sm ring-2 transition',
            value === theme ? 'ring-accent' : 'ring-transparent hover:ring-line',
          )}
        >
          <span
            className="relative block h-16 w-full shrink-0 rounded-xl"
            style={{ background: THEME_SWATCHES[theme] }}
          >
            {value === theme ? (
              <Check className="absolute right-2 bottom-2 size-4 rounded-full bg-accent p-0.5 text-accent-fg" />
            ) : null}
          </span>
          <span className="px-1 font-medium">{THEME_LABELS[theme]}</span>
        </button>
      ))}
    </div>
  )
}

export function WallpaperPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (wallpaper: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const custom = value.startsWith('/uploads/') ? value : null

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const { url } = await settingsApi.upload(file)
      onChange(url)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      {WALLPAPERS.map((wallpaper) => (
        <button
          key={wallpaper}
          type="button"
          onClick={() => onChange(wallpaper)}
          aria-pressed={value === wallpaper}
          className={cn(
            'pressable flex w-24 flex-col items-center gap-1.5 rounded-2xl p-1.5 text-xs ring-2',
            value === wallpaper ? 'ring-accent' : 'ring-transparent hover:ring-line',
          )}
        >
          <span
            data-wallpaper={wallpaper}
            className="h-14 w-full rounded-xl"
            style={{ background: 'var(--wallpaper)' }}
          />
          {WALLPAPER_LABELS[wallpaper]}
        </button>
      ))}
      {custom ? (
        <button
          type="button"
          aria-pressed
          className="pressable flex w-24 flex-col items-center gap-1.5 rounded-2xl p-1.5 text-xs ring-2 ring-accent"
        >
          <img src={custom} alt="自定义壁纸" className="h-14 w-full rounded-xl object-cover" />
          自定义
        </button>
      ) : null}
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        className="pressable flex w-24 flex-col items-center gap-1.5 rounded-2xl p-1.5 text-xs text-fg-muted ring-2 ring-transparent hover:ring-line"
      >
        <span className="flex h-14 w-full items-center justify-center rounded-xl bg-surface">
          <ImagePlus className="size-5" />
        </span>
        {uploading ? '上传中…' : '上传图片'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void upload(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
