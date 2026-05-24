import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SetupScreen } from '@/components/setup/SetupScreen'
import { InterviewScreen } from '@/components/interview/InterviewScreen'
import { useInterviewStore } from '@/store/useInterviewStore'

export default function App() {
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
