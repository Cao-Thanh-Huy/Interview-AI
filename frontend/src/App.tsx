import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SetupScreen } from '@/components/setup/SetupScreen'
import { InterviewScreen } from '@/components/interview/InterviewScreen'
import { useInterviewStore } from '@/store/useInterviewStore'
import { SplashScreen, ActivationPage, useLicenseCheck } from '@/components/activation/ActivationPage'
import { ApiSetupPage, useApiKeysCheck } from '@/components/activation/ApiSetupPage'
import { SettingsButton } from '@/components/activation/SettingsModal'

// ─── Main App (chỉ render khi license hợp lệ) ────────────────────────────────
function MainApp() {
  const { phase, toggleStealth } = useInterviewStore()

  // Global keyboard shortcut: Ctrl+Shift+H — toggle stealth
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyH') {
        e.preventDefault()
        toggleStealth()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleStealth])

  return (
    <AnimatePresence mode="wait">
      {phase === 'setup' ? (
        <motion.div
          key="setup"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25 }}
        >
          <SetupScreen />
        </motion.div>
      ) : (
        <motion.div
          key="interview"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="h-screen"
        >
          <InterviewScreen />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Root — License Gate → API Setup Gate → Main App ─────────────────────────
export default function App() {
  const { state, hwid, message, markActivated } = useLicenseCheck()
  const { checked: apiChecked, keysReady, markReady } = useApiKeysCheck()

  // Step 0: Connecting
  if (state === 'connecting') return <SplashScreen />

  // Step 1: License activation
  if (state === 'not_activated') {
    return (
      <ActivationPage
        hwid={hwid}
        errorMessage={message}
        onActivated={markActivated}
      />
    )
  }

  // Step 2: API keys setup (chỉ hiện khi license OK nhưng chưa check keys xong)
  if (!apiChecked) return <SplashScreen />

  if (!keysReady) {
    return <ApiSetupPage onComplete={markReady} />
  }

  // Step 3: Main app + floating settings button
  return (
    <>
      <MainApp />
      <SettingsButton
        onLicenseDeactivated={() => window.location.reload()}
      />
    </>
  )
}
