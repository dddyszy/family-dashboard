import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  type LucideIcon,
  Moon,
  Sun,
} from 'lucide-react'

type WeatherInfo = { label: string; icon: LucideIcon; color: string }

/** WMO weather interpretation codes as returned by Open-Meteo. */
export function describeWeather(code: number, isDay = true): WeatherInfo {
  if (code === 0) return { label: '晴', icon: isDay ? Sun : Moon, color: '#ffb800' }
  if (code <= 2)
    return {
      label: code === 1 ? '晴间多云' : '多云',
      icon: isDay ? CloudSun : CloudMoon,
      color: '#ffb800',
    }
  if (code === 3) return { label: '阴', icon: Cloud, color: '#8e9bb0' }
  if (code === 45 || code === 48) return { label: '雾', icon: CloudFog, color: '#8e9bb0' }
  if (code >= 51 && code <= 57) return { label: '毛毛雨', icon: CloudDrizzle, color: '#4aa3ff' }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    const heavy = code === 65 || code === 67 || code === 82
    return {
      label: heavy ? '大雨' : code === 61 || code === 80 ? '小雨' : '中雨',
      icon: CloudRain,
      color: '#2f8cff',
    }
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return { label: '雪', icon: CloudSnow, color: '#9fd3ff' }
  }
  if (code >= 95) return { label: '雷阵雨', icon: CloudLightning, color: '#a77bff' }
  return { label: '未知', icon: Cloud, color: '#8e9bb0' }
}
