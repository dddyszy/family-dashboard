export type FeatureAvailability = 'available' | 'https-required' | 'unsupported'

export function featureAvailability(secure: boolean, supported: boolean): FeatureAvailability {
  if (!secure) return 'https-required'
  return supported ? 'available' : 'unsupported'
}

export function browserCapabilities() {
  const secure = window.isSecureContext
  return {
    secure,
    offline: featureAvailability(secure, 'serviceWorker' in navigator),
    wakeLock: featureAvailability(secure, 'wakeLock' in navigator),
  }
}
