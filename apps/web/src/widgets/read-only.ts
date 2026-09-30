import { createContext, useContext } from 'react'

/** True on kiosk devices, where widgets must not offer write actions. */
export const ReadOnlyContext = createContext(false)

export function useReadOnly(): boolean {
  return useContext(ReadOnlyContext)
}
