import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SetupScreen } from '@/components/setup/SetupScreen'
import { InterviewScreen } from '@/components/interview/InterviewScreen'
import { useInterviewStore } from '@/store/useInterviewStore'
import { useUiMode } from '@/store/useUiMode'
import { CommandPalette } from '@/components/CommandPalette'
import { SplashScreen, ActivationPage, useLicenseCheck } from '@/components/activation/ActivationPage'
import { ApiSetupPage, useApiKeysCheck } from '@/components/activation/ApiSetupPage'

// Electron IPC listener (safe fallback)
const eWin = typeof window !== 'undefined' ? (window as any).electronWindow : null

// ─── Main App ────────────────────────────────────────────────────────────────
function MainApp() {
  const { phase, toggleStealth } = useInterviewStore()
  const { setMode, setAlwaysOnTop } = useUiMode()
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+K → command palette
      if (e.ctrlKey && e.code === 'KeyK') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      // Ctrl+Shift+H → stealth
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyH') {
        e.preventDefault()
        toggleStealth()
        return
      }
      // Ctrl+Shift+0/1/2 → UiMode
      if (e.ctrlKey && e.shiftKey && e.code === 'Digit0') { e.preventDefault(); setMode('default') }
      if (e.ctrlKey && e.shiftKey && e.code === 'Digit1') { e.preventDefault(); setMode('focused-notes') }
      if (e.ctrlKey && e.shiftKey && e.code === 'Digit2') { e.preventDefault(); setMode('ide-camouflage') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleStealth, setMode])

  // Listen for AOT changes from Electron main process
  useEffect(() => {
    if (!eWin?.onAotChanged) return
    const cleanup = eWin.onAotChanged((val: boolean) => setAlwaysOnTop(val))
    return cleanup
  }, [setAlwaysOnTop])

  return (
    <>
      <AnimatePresence mode="wait">
        {phase === 'setup' ? (
          <motion.div
            key="setup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ height: '100%' }}
          >
            <SetupScreen />
          </motion.div>
        ) : (
          <motion.div
            key="interview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ height: '100%' }}
          >
            <InterviewScreen />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Command Palette — mounted globally */}
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  )
}

// ─── Root — License Gate → API Setup Gate → Main App ─────────────────────────
export default function App() {
  const { state, hwid, message, markActivated } = useLicenseCheck()
  const { checked: apiChecked, keysReady, markReady } = useApiKeysCheck()

  if (state === 'connecting') return <SplashScreen />
  if (state === 'not_activated') {
    return <ActivationPage hwid={hwid} errorMessage={message} onActivated={markActivated} />
  }
  if (!apiChecked) return <SplashScreen />
  if (!keysReady) return <ApiSetupPage onComplete={markReady} />

  return <MainApp />
}
