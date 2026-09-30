import { create } from 'zustand'

let context: AudioContext | null = null

export const useSoundState = create<{ unlocked: boolean }>(() => ({ unlocked: false }))

/** Must run inside a user gesture: browsers block audio until the page has been interacted with. */
export async function unlockSound(): Promise<void> {
  if (!context) context = new AudioContext()
  if (context.state === 'suspended') await context.resume()
  useSoundState.setState({ unlocked: context.state === 'running' })
}

export function installGestureUnlock(): () => void {
  const handler = () => {
    void unlockSound()
    window.removeEventListener('pointerdown', handler)
    window.removeEventListener('keydown', handler)
  }
  window.addEventListener('pointerdown', handler)
  window.addEventListener('keydown', handler)
  return () => {
    window.removeEventListener('pointerdown', handler)
    window.removeEventListener('keydown', handler)
  }
}

/** A soft two-note chime synthesised on the fly, so no audio asset is needed. */
export function playChime(): void {
  if (!context) return
  if (context.state !== 'running') return
  const start = context.currentTime
  const notes = [
    { freq: 880, at: 0 },
    { freq: 1318.5, at: 0.18 },
  ]
  for (const note of notes) {
    const osc = context.createOscillator()
    const gain = context.createGain()
    osc.type = 'sine'
    osc.frequency.value = note.freq
    gain.gain.setValueAtTime(0.0001, start + note.at)
    gain.gain.exponentialRampToValueAtTime(0.25, start + note.at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.at + 0.9)
    osc.connect(gain).connect(context.destination)
    osc.start(start + note.at)
    osc.stop(start + note.at + 1)
  }
}
