import type { WeatherData } from '@shared/schemas/home'
import type { Deps } from '../lib/context'
import { AppError } from '../lib/errors'
import { getHousehold } from './settings'

const TTL_MS = 30 * 60 * 1000
const TIMEOUT_MS = 5000

type CacheEntry = { key: string; data: WeatherData; fetchedAt: number }
let cache: CacheEntry | null = null
let inflight: Promise<WeatherData> | null = null

type OpenMeteoResponse = {
  current: {
    temperature_2m: number
    apparent_temperature: number
    relative_humidity_2m: number
    weather_code: number
    is_day: number
  }
  daily: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
  }
}

async function fetchWeather(
  lat: number,
  lon: number,
  name: string,
  now: number,
): Promise<WeatherData> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day',
  )
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min')
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', '6')
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`Open-Meteo 返回 ${res.status}`)
  const body = (await res.json()) as OpenMeteoResponse
  return {
    location: name,
    updatedAt: now,
    current: {
      temperature: body.current.temperature_2m,
      apparentTemperature: body.current.apparent_temperature,
      humidity: body.current.relative_humidity_2m,
      weatherCode: body.current.weather_code,
      isDay: body.current.is_day === 1,
    },
    daily: body.daily.time.map((date, i) => ({
      date,
      weatherCode: body.daily.weather_code[i] ?? 0,
      max: body.daily.temperature_2m_max[i] ?? 0,
      min: body.daily.temperature_2m_min[i] ?? 0,
    })),
  }
}

/** Serves from a 30-minute cache; on upstream failure falls back to stale data when available. */
export async function getWeather(deps: Deps): Promise<WeatherData> {
  const { lat, lon, name } = getHousehold(deps).weather
  const key = `${lat},${lon},${name}`
  const now = deps.now()
  if (cache?.key === key && now - cache.fetchedAt < TTL_MS) return cache.data
  if (!inflight) {
    inflight = fetchWeather(lat, lon, name, now)
      .then((data) => {
        cache = { key, data, fetchedAt: now }
        return data
      })
      .finally(() => {
        inflight = null
      })
  }
  try {
    return await inflight
  } catch (error) {
    if (cache?.key === key) return cache.data
    console.warn('获取天气失败', error)
    throw new AppError('WEATHER_UNAVAILABLE', '暂时无法获取天气', 502)
  }
}
