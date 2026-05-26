import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchDeepgramKey } from '@/lib/api'
import type { DeepgramStatus, AudioSource } from '@/lib/types'

interface UseDeepgramOptions {
  onTranscript: (text: string, isFinal: boolean) => void
  onUtteranceEnd: (fullTranscript: string) => void
  onStatusChange?: (status: DeepgramStatus) => void
  onError?: (message: string) => void
  onWarning?: (message: string) => void
}

export function useDeepgram({
  onTranscript,
  onUtteranceEnd,
  onStatusChange,
  onError,
  onWarning,
}: UseDeepgramOptions) {
  const [status, setStatus] = useState<DeepgramStatus>('idle')
  const [audioSource, setAudioSource] = useState<AudioSource>(null)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [isMuted, setIsMuted] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const displayStreamRef = useRef<MediaStream | null>(null)
  const audioQueueRef = useRef<Blob[]>([])
  const isProcessingRef = useRef(false)
  const pendingTranscriptRef = useRef('')
  const isMutedRef = useRef(false)
  const keepAliveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const connectionIdRef = useRef(0)

  const updateStatus = useCallback(
    (s: DeepgramStatus) => {
      setStatus(s)
      onStatusChange?.(s)
    },
    [onStatusChange],
  )

  const flushAudioQueue = useCallback(() => {
    if (
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN ||
      isProcessingRef.current ||
      audioQueueRef.current.length === 0
    )
      return

    isProcessingRef.current = true
    const blob = audioQueueRef.current.shift()!

    try {
      wsRef.current.send(blob)
    } catch (e) {
      console.error('Error sending audio blob:', e)
    }

    setTimeout(() => {
      isProcessingRef.current = false
      flushAudioQueue()
    }, 250)
  }, [])

  const openWebSocket = useCallback(
    async (audioStream: MediaStream, currentId: number) => {
      updateStatus('connecting')

      let key: string
      try {
        const result = await fetchDeepgramKey()
        if (currentId !== connectionIdRef.current) {
          audioStream.getTracks().forEach((t) => t.stop())
          return
        }
        key = result.key
      } catch (err) {
        if (currentId !== connectionIdRef.current) {
          audioStream.getTracks().forEach((t) => t.stop())
          return
        }
        onError?.(`Failed to get API key: ${(err as Error).message}`)
        updateStatus('error')
        return
      }

      // Pick the best supported audio MIME type (opus preferred, fallback to pcm via wav)
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
        utterance_end_ms: '1000',
        vad_events: 'true',
        endpointing: '300',
        // Tell Deepgram the exact container/codec so it doesn't have to guess
        ...(preferredMime.includes('opus') && { encoding: 'opus', container: 'webm' }),
      })

      const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ['token', key])
      wsRef.current = ws

      ws.onopen = () => {
        updateStatus('connected')

        const recorderOptions = preferredMime ? { mimeType: preferredMime } : {}
        const recorder = new MediaRecorder(audioStream, recorderOptions)
        recorderRef.current = recorder

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && !isMutedRef.current) {
            audioQueueRef.current.push(e.data)
            flushAudioQueue()
          }
        }

        recorder.start(500)
      }

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data as string)

          if (data.type === 'Results') {
            const words: Array<{ punctuated_word?: string; word: string }> =
              data.channel?.alternatives?.[0]?.words ?? []
            const text = words.map((w) => w.punctuated_word ?? w.word).join(' ')

            if (text.trim()) {
              if (data.is_final) {
                pendingTranscriptRef.current +=
                  (pendingTranscriptRef.current ? ' ' : '') + text
                onTranscript(pendingTranscriptRef.current, true)
              } else {
                const fullText = pendingTranscriptRef.current
                  ? pendingTranscriptRef.current + ' ' + text
                  : text
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
          }
        } catch (err) {
          console.error('Error parsing Deepgram message:', err)
        }
      }

      ws.onclose = (event) => {
        const isNormal = event.code === 1000 || event.code === 1005
        if (!isNormal && event.code !== 0) {
          onError?.(`Connection closed unexpectedly (code: ${event.code})`)
        }
        updateStatus('idle')
        recorderRef.current?.stop()
      }

      ws.onerror = () => {
        onError?.('WebSocket error. Check your API key and network connection.')
        updateStatus('error')
      }
    },
    [updateStatus, flushAudioQueue, onTranscript, onUtteranceEnd, onError],
  )

  const start = useCallback(async () => {
    const currentId = ++connectionIdRef.current

    // ── Step 1: get microphone (reliable baseline, no dialog) ──────────
    let audioStream: MediaStream | null = null

    try {
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (currentId !== connectionIdRef.current) {
        audioStream?.getTracks().forEach((t) => t.stop())
        return
      }
      setAudioSource('microphone')
    } catch {
      // Mic denied — will still try system audio below
    }

    // ── Step 2: try screen share for system audio (optional upgrade) ───
    try {
      const displayMedia = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      })

      if (currentId !== connectionIdRef.current) {
        displayMedia.getTracks().forEach((t) => t.stop())
        audioStream?.getTracks().forEach((t) => t.stop())
        return
      }

      displayStreamRef.current = displayMedia

      const videoTracks = displayMedia.getVideoTracks()
      if (videoTracks.length > 0) {
        setScreenStream(new MediaStream(videoTracks))
      }

      const systemAudioTracks = displayMedia.getAudioTracks()
      if (systemAudioTracks.length > 0) {
        // System audio available → upgrade, release mic to save resources
        audioStream?.getTracks().forEach((t) => t.stop())
        audioStream = new MediaStream(systemAudioTracks)
        setAudioSource('system')
      } else {
        // Screen shared but no audio — warn the user
        onWarning?.(
          '⚠️ Screen shared but no audio detected. In your share dialog, enable "Share system audio" / "Share tab audio" to capture interviewer voice.',
        )
      }

      displayMedia.getVideoTracks()[0]?.addEventListener('ended', () => stop())
    } catch (err) {
      const error = err as Error
      // User cancelled screen share (NotAllowedError / AbortError) → fine, keep mic
      if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
        console.warn('getDisplayMedia failed:', error.message)
      }
      if (currentId !== connectionIdRef.current) {
        audioStream?.getTracks().forEach((t) => t.stop())
        return
      }
    }

    // ── Step 3: ensure we have audio from at least one source ──────────
    if (!audioStream) {
      onError?.(
        'Microphone access denied. Please allow microphone access in your browser settings and try again.',
      )
      updateStatus('idle')
      return
    }

    audioStreamRef.current = audioStream
    await openWebSocket(audioStream, currentId)
  }, [openWebSocket, onError, updateStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMute = useCallback(() => {
    const next = !isMutedRef.current
    isMutedRef.current = next
    setIsMuted(next)
    if (next) {
      // Muted: send KeepAlive every 8s so Deepgram doesn't timeout with code 1011
      keepAliveIntervalRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'KeepAlive' }))
        }
      }, 8000)
    } else {
      // Unmuted: stop keep-alive, discard blobs recorded while muted
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current)
        keepAliveIntervalRef.current = null
      }
      audioQueueRef.current = []
    }
  }, [])

  const stop = useCallback(() => {
    connectionIdRef.current++
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current)
      keepAliveIntervalRef.current = null
    }
    isMutedRef.current = false

    recorderRef.current?.stop()
    recorderRef.current = null

    wsRef.current?.close()
    wsRef.current = null

    audioStreamRef.current?.getTracks().forEach((t) => t.stop())
    audioStreamRef.current = null

    displayStreamRef.current?.getTracks().forEach((t) => t.stop())
    displayStreamRef.current = null

    setScreenStream(null)
    setAudioSource(null)
    pendingTranscriptRef.current = ''
    audioQueueRef.current = []
    isProcessingRef.current = false

    updateStatus('idle')
  }, [updateStatus])

  useEffect(() => () => stop(), [stop])

  return { start, stop, status, audioSource, screenStream, isMuted, toggleMute }
}
