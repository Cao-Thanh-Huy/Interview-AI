import { create } from 'zustand'

interface UiModeStore {
  isAlwaysOnTop: boolean
  setAlwaysOnTop: (v: boolean) => void
}

export const useUiMode = create<UiModeStore>((set) => ({
  isAlwaysOnTop: false,
  setAlwaysOnTop: (isAlwaysOnTop) => set({ isAlwaysOnTop }),
}))
