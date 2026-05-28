import { create } from 'zustand'

export type UiMode = 'default' | 'focused-notes' | 'ide-camouflage'

interface UiModeStore {
  mode: UiMode
  isAlwaysOnTop: boolean
  setMode: (m: UiMode) => void
  setAlwaysOnTop: (v: boolean) => void
}

export const useUiMode = create<UiModeStore>((set) => ({
  mode: 'default',
  isAlwaysOnTop: false,

  setMode: (mode) => {
    set({ mode })
    // Apply data-mode attribute to <html> element
    document.documentElement.setAttribute('data-mode', mode === 'default' ? '' : mode)
    if (mode === 'default') {
      document.documentElement.removeAttribute('data-mode')
    }
  },

  setAlwaysOnTop: (isAlwaysOnTop) => set({ isAlwaysOnTop }),
}))
