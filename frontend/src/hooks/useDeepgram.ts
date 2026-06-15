import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchDeepgramKey } from '@/lib/api'
import type { DeepgramStatus } from '@/lib/types'

interface UseDeepgramOptions {
  stream: MediaStream | null       // từ useAudioCapture, persistent
  onTranscript: (text: string, isFinal: boolean) => void
  onUtteranceEnd: (fullTranscript: string) => void
  onStatusChange?: (status: DeepgramStatus) => void
  onError?: (message: string) => void
  onWarning?: (message: string) => void
}

interface UseDeepgramReturn {
  start: () => Promise<void>
  stop: () => void
  status: DeepgramStatus
  isMuted: boolean
  toggleMute: () => void
  closeWasClean: boolean  // true nếu WS đóng sạch ko transcript → ko reconnect
}

export function useDeepgram({
  stream,
  onTranscript,
  onUtteranceEnd,
  onStatusChange,
  onError,
}: UseDeepgramOptions): UseDeepgramReturn {
  const [status, setStatus] = useState<DeepgramStatus>('idle')
  const [isMuted, setIsMuted] = useState(false)
  const [closeWasClean, setCloseWasClean] = useState(false)  // true nếu WS đóng sạch ko transcript

  const wsRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioQueueRef = useRef<Blob[]>([])
  const isProcessingRef = useRef(false)
  const pendingTranscriptRef = useRef('')
  const isMutedRef = useRef(false)
  const keepAliveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const connectionIdRef = useRef(0)
  const lastTranscriptTimeRef = useRef(Date.now())
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef<(() => Promise<void>) | null>(null)
  const isStoppedRef = useRef(true)
  const watchdogRestartCountRef = useRef(0)
  const MAX_WATCHDOG_RESTARTS = 1
  const closeWasCleanRef = useRef(false)  // true nếu WS đóng sạch (code 1000/1005) ko có transcript

  const updateStatus = useCallback(
    (s: DeepgramStatus) => {
      setStatus(s)
      onStatusChange?.(s)
    },
    [onStatusChange],
  )

  // ── Audio queue flush ────────────────────────────────────────────────────
  const flushAudioQueue = useCallback(() => {
    if (
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN ||
      isProcessingRef.current ||
      audioQueueRef.current.length === 0
    )
      return

    isProcessingRef.current = true
    const genId = connectionIdRef.current  // capture generation để tránh stale timeout
    const blob = audioQueueRef.current.shift()!
    console.log('[Deepgram] Sending blob size:', blob.size, 'wsReady:', wsRef.current?.readyState, 'gen:', genId)

    try {
      wsRef.current.send(blob)
    } catch (e) {
      console.error('Error sending audio blob:', e)
    }

    setTimeout(() => {
      isProcessingRef.current = false
      // Nếu connectionId thay đổi (session mới), ko recurse — tránh stale timeout
      if (connectionIdRef.current !== genId) {
        console.log('[Deepgram] Stale flush timeout skipped (gen changed)')
        return
      }
      flushAudioQueue()
    }, 250)
  }, [])

  // ── Open WebSocket + MediaRecorder ──────────────────────────────────────
  const openWebSocket = useCallback(
    async (audioStream: MediaStream, currentId: number) => {
      updateStatus('connecting')

      let key: string
      try {
        const result = await fetchDeepgramKey()
        if (currentId !== connectionIdRef.current) {
          // Stale — chỉ return, ko stop stream (useAudioCapture quản lý)
          return
        }
        key = result.key
        console.log('[Deepgram] Key ready, length:', key?.length)
      } catch (err) {
        if (currentId !== connectionIdRef.current) {
          return
        }
        onError?.(`Failed to get API key: ${(err as Error).message}`)
        updateStatus('error')
        return
      }

      // Pick best supported audio MIME
      const preferredMime = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
      ].find((m) => MediaRecorder.isTypeSupported(m)) ?? ''

      const params = new URLSearchParams({
        model: 'nova-2',
        interim_results: 'true',
        smart_format: 'true',
        punctuate: 'true',
        utterance_end_ms: '3500',
        vad_events: 'true',
        endpointing: '800',
        encoding: 'opus',  // BẮT BUỘC cho streaming WebSocket
      })

      const wsUrl = `wss://api.deepgram.com/v1/listen?${params}`
      console.log('[Deepgram] WS URL:', wsUrl)
      const ws = new WebSocket(wsUrl, ['token', key])
      wsRef.current = ws

      // Biến ở scope openWebSocket — các handler đều truy cập được
      let gotTranscript = false
      let transcriptTimer: ReturnType<typeof setTimeout> | null = null

      ws.onopen = () => {
        console.log('[Deepgram] WebSocket opened ✅ — readyState:', ws.readyState)
        updateStatus('connected')

        // Tạo MediaRecorder từ audioStream có sẵn (ko acquire lại)
        const recorderOptions = preferredMime ? { mimeType: preferredMime } : {}
        const recorder = new MediaRecorder(audioStream, recorderOptions)
        recorderRef.current = recorder

        let chunkCount = 0
        recorder.ondataavailable = (e) => {
          // Nếu recorder này ko còn là recorder hiện tại → stale event từ session cũ
          if (recorderRef.current !== recorder) return
          chunkCount++
          if (chunkCount <= 5 || chunkCount % 20 === 0) {
            console.log(`[Audio] Chunk #${chunkCount} size=${e.data.size} bytes, muted=${isMutedRef.current}`)
          }
          if (e.data.size > 0 && !isMutedRef.current) {
            audioQueueRef.current.push(e.data)
            flushAudioQueue()
          }
        }

        recorder.start(500)
        console.log('[Audio] MediaRecorder started, mimeType:', recorder.mimeType)

        recorder.onerror = () => {
          console.error('[Audio] MediaRecorder error ❌')
          recorder.stop()
          wsRef.current?.close()
          updateStatus('idle')
        }
        recorder.onstop = () => {
          console.log('[Audio] MediaRecorder stopped')
          // Clear queue — ondataavailable cuối cùng có thể fire async sau stop()
          // Chỉ clear khi recorder này là recorder hiện tại (tránh clear queue của session mới)
          if (recorderRef.current === recorder) {
            audioQueueRef.current = []
            recorderRef.current = null
          }
        }

        // Watchdog: zombie connection (120s no transcript)
        if (watchdogRef.current) clearInterval(watchdogRef.current)
        lastTranscriptTimeRef.current = Date.now()
        watchdogRef.current = setInterval(() => {
          const elapsed = Date.now() - lastTranscriptTimeRef.current
          if (elapsed > 120000) {
            console.warn(`[Watchdog] No transcript for ${Math.round(elapsed / 1000)}s — reconnecting...`)
            recorderRef.current?.stop()
            wsRef.current?.close()
            updateStatus('idle')
          }
        }, 10000)

        // Transcript silence watchdog (25s từ khi WS mở)
        gotTranscript = false
        transcriptTimer = setTimeout(() => {
          if (gotTranscript || !startRef.current || isStoppedRef.current) return
          if (watchdogRestartCountRef.current >= MAX_WATCHDOG_RESTARTS) {
            console.warn(`[Deepgram] Max restarts (${MAX_WATCHDOG_RESTARTS}) reached. Audio may be silent.`)
            onError?.('Audio capture failed after retries.')
            return
          }
          watchdogRestartCountRef.current++
          console.warn(`[Deepgram] No transcript in 25s (${watchdogRestartCountRef.current}/${MAX_WATCHDOG_RESTARTS}) — restarting WebSocket...`)
          recorderRef.current?.stop()
          ws.close()
          // Chỉ restart WS — stream vẫn còn, ko acquire lại audio
          setTimeout(() => startRef.current?.(), 1000)
        }, 25000)
      } // end ws.onopen

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data as string)

          if (data.type === 'Results') {
            const words: Array<{ punctuated_word?: string; word: string }> =
              data.channel?.alternatives?.[0]?.words ?? []
            const text = words.map((w) => w.punctuated_word ?? w.word).join(' ')

            if (text.trim()) {
              gotTranscript = true
              clearTimeout(transcriptTimer)

              if (data.is_final) {
                pendingTranscriptRef.current +=
                  (pendingTranscriptRef.current ? ' ' : '') + text
                lastTranscriptTimeRef.current = Date.now()
                onTranscript(pendingTranscriptRef.current, true)
              } else {
                const fullText = pendingTranscriptRef.current
                  ? pendingTranscriptRef.current + ' ' + text
                  : text
                lastTranscriptTimeRef.current = Date.now()
                onTranscript(fullText, false)
              }
            }
          } else if (data.type === 'UtteranceEnd') {
            const accumulated = pendingTranscriptRef.current.trim()
            if (accumulated) {
              onUtteranceEnd(accumulated)
              pendingTranscriptRef.current = ''
              onTranscript('', true)
            }
          } else {
            // Log ALL messages để debug Session 2+ không transcript
            console.log('[Deepgram] Raw message type:', data.type, JSON.stringify(data).slice(0, 300))
          }
        } catch (err) {
          const preview = typeof e.data === 'string' ? e.data.slice(0, 200) : String(e.data).slice(0, 200)
          console.error('Error parsing Deepgram message:', err, '| raw:', preview)
        }
      }

      ws.onclose = (event) => {
        console.log(`[Deepgram] WebSocket closed — code: ${event.code}, reason: ${event.reason || '(no reason)'}, wasClean: ${event.wasClean}`)
        clearTimeout(transcriptTimer)
        if (currentId !== connectionIdRef.current) {
          console.log('[Deepgram] Ignoring stale WS close event')
          return
        }
        if (watchdogRef.current) {
          clearInterval(watchdogRef.current)
          watchdogRef.current = null
        }
        const isNormal = event.code === 1000 || event.code === 1005
        const wasClean = isNormal && !gotTranscript
        closeWasCleanRef.current = wasClean
        if (wasClean) setCloseWasClean(true)
        if (!isNormal && event.code !== 0) {
          onError?.(`Connection closed unexpectedly (code: ${event.code})`)
        }
        updateStatus('idle')
        recorderRef.current?.stop()
      }

      ws.onerror = (err) => {
        console.error('[Deepgram] WebSocket error ❌:', err)
        clearTimeout(transcriptTimer)
        if (currentId !== connectionIdRef.current) {
          console.log('[Deepgram] Ignoring stale WS error')
          return
        }
        onError?.('WebSocket error. Check your API key and network connection.')
        updateStatus('error')
      }
    },
    [updateStatus, flushAudioQueue, onTranscript, onUtteranceEnd, onError],
  )

  // ── Start — chỉ connect WS, ko acquire audio ────────────────────────────
  const start = useCallback(async () => {
    if (!stream) {
      console.warn('[Deepgram] start() called but no stream available')
      return
    }

    isStoppedRef.current = false
    closeWasCleanRef.current = false
    setCloseWasClean(false)
    const currentId = ++connectionIdRef.current
    await openWebSocket(stream, currentId)
  }, [stream, openWebSocket])

  // Sync ref để watchdog restart có thể gọi start()
  startRef.current = start

  // ── Toggle mute ──────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const next = !isMutedRef.current
    isMutedRef.current = next
    setIsMuted(next)
    if (next) {
      keepAliveIntervalRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'KeepAlive' }))
        }
      }, 8000)
    } else {
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current)
        keepAliveIntervalRef.current = null
      }
      audioQueueRef.current = []
    }
  }, [])

  // ── Stop — chỉ close WS + recorder, KO stop audio stream ────────────────
  const stop = useCallback(() => {
    isStoppedRef.current = true
    watchdogRestartCountRef.current = 0
    connectionIdRef.current++

    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current)
      keepAliveIntervalRef.current = null
    }
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current)
      watchdogRef.current = null
    }

    isMutedRef.current = false

    // Close WS TRƯỚC recorder — ngăn recorder's final ondataavailable
    // gửi blob qua WS cũ (gây stale blob ở Session 2+)
    wsRef.current?.close()
    wsRef.current = null

    recorderRef.current?.stop()
    recorderRef.current = null

    // KHÔNG stop stream — useAudioCapture quản lý
    // KHÔNG stop level meter — useAudioCapture quản lý

    pendingTranscriptRef.current = ''
    audioQueueRef.current = []
    isProcessingRef.current = false

    updateStatus('idle')
  }, [updateStatus])

  // Cleanup on unmount — KHÔNG dùng [stop] vì stop thay đổi theo mỗi render
  // (onStatusChange inline → updateStatus mới → stop mới), gây cleanup chạy liên tục
  // → connectionIdRef++ mỗi lần → fetchDeepgramKey bị stale check → stop audio stream
  const stopRef = useRef(stop)
  stopRef.current = stop
  useEffect(() => () => {
    stopRef.current()
  }, [])

  return { start, stop, status, isMuted, toggleMute, closeWasClean }
}
