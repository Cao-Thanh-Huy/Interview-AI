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
}: UseDeepgramOptions) {
  const [status, setStatus] = useState<DeepgramStatus>('idle')
  const [audioSource, setAudioSource] = useState<AudioSource>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)  // 0-100 integer

  const wsRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const audioQueueRef = useRef<Blob[]>([])
  const isProcessingRef = useRef(false)
  const pendingTranscriptRef = useRef('')
  const isMutedRef = useRef(false)
  const keepAliveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const connectionIdRef = useRef(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const levelRafRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const updateStatus = useCallback(
    (s: DeepgramStatus) => {
      setStatus(s)
      onStatusChange?.(s)
    },
    [onStatusChange],
  )

  // ── Audio level analyser ────────────────────────────────────────────────────
  const startLevelMeter = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      // Resume is required — Chromium may suspend AudioContext without user gesture
      ctx.resume().then(() => console.log('[Audio] AudioContext state:', ctx.state))
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.4
      source.connect(analyser)
      analyserRef.current = analyser

      const buf = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(buf)
        const avg = buf.reduce((s, v) => s + v, 0) / buf.length
        setAudioLevel(Math.round(avg))
        levelRafRef.current = requestAnimationFrame(tick)
      }
      levelRafRef.current = requestAnimationFrame(tick)
    } catch {
      // AudioContext not supported — ignore
    }
  }, [])

  const stopLevelMeter = useCallback(() => {
    if (levelRafRef.current) cancelAnimationFrame(levelRafRef.current)
    levelRafRef.current = null
    analyserRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    setAudioLevel(0)
  }, [])

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
        console.log('[Deepgram] Key ready, length:', key?.length)
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

      const wsUrl = `wss://api.deepgram.com/v1/listen?${params}`
      console.log('[Deepgram] Connecting to Deepgram WebSocket...')
      const ws = new WebSocket(wsUrl, ['token', key])
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[Deepgram] WebSocket opened ✅ — readyState:', ws.readyState)
        updateStatus('connected')

        // Start level meter
        startLevelMeter(audioStream)

        const recorderOptions = preferredMime ? { mimeType: preferredMime } : {}
        const recorder = new MediaRecorder(audioStream, recorderOptions)
        recorderRef.current = recorder

        let chunkCount = 0
        recorder.ondataavailable = (e) => {
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
        console.log(`[Deepgram] WebSocket closed — code: ${event.code}, reason: ${event.reason || '(no reason)'}, wasClean: ${event.wasClean}`)
        const isNormal = event.code === 1000 || event.code === 1005
        if (!isNormal && event.code !== 0) {
          onError?.(`Connection closed unexpectedly (code: ${event.code})`)
        }
        stopLevelMeter()
        updateStatus('idle')
        recorderRef.current?.stop()
      }

      ws.onerror = (err) => {
        console.error('[Deepgram] WebSocket error ❌:', err)
        onError?.('WebSocket error. Check your API key and network connection.')
        stopLevelMeter()
        updateStatus('error')
      }
    },
    [updateStatus, flushAudioQueue, onTranscript, onUtteranceEnd, onError, startLevelMeter, stopLevelMeter],
  )

  const start = useCallback(async (deviceId?: string) => {
    const currentId = ++connectionIdRef.current
    let audioStream: MediaStream | null = null

    const isElectron = !!(window as unknown as { electronAudio?: unknown }).electronAudio

    // ── Tier 1: WASAPI loopback via Electron (works on ANY Windows machine) ─────
    // Main process setDisplayMediaRequestHandler intercepts getDisplayMedia:
    //   video → WebFrameMain  (Chromium-internal compositing, ZERO DXGI)
    //   audio → 'loopback'    (Windows WASAPI render endpoint, built into all Windows)
    if (isElectron && !deviceId) {
      // Tier 1a: Try getDisplayMedia directly (works when there's a user gesture)
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        if (currentId !== connectionIdRef.current) { stream.getTracks().forEach(t => t.stop()); return }
        stream.getVideoTracks().forEach(t => t.stop())
        const tracks = stream.getAudioTracks()
        console.log(`[Audio] getDisplayMedia returned ${tracks.length} audio track(s)`, tracks.map(t => t.label))
        if (tracks.length > 0) {
          audioStream = new MediaStream(tracks)
          setAudioSource('system')
          console.log('[Audio] ✅ WASAPI loopback active (Tier 1a — getDisplayMedia)')
        } else {
          console.warn('[Audio] ⚠️ Tier 1a: 0 audio tracks — WASAPI returned no audio, falling to Tier 1b')
        }
      } catch (err) {
        if (currentId !== connectionIdRef.current) return
        console.warn('[Audio] ⚠️ Tier 1a getDisplayMedia blocked (likely no user gesture in overlay):', err)
      }

      // Tier 1b: IPC-based capture — main process grabs source ID (bypasses user-gesture requirement)
      if (!audioStream) {
        try {
          const electronAudio = (window as unknown as { electronAudio?: { requestDisplayCapture: () => Promise<string | null> } }).electronAudio
          const sourceId = await electronAudio?.requestDisplayCapture()
          if (currentId !== connectionIdRef.current) return
          console.log('[Audio] Tier 1b: sourceId from IPC =', sourceId)
          if (sourceId) {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                // @ts-expect-error — Electron/Chromium-specific constraint
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: sourceId,
                },
              },
              video: false,
            })
            if (currentId !== connectionIdRef.current) { stream.getTracks().forEach(t => t.stop()); return }
            const tracks = stream.getAudioTracks()
            console.log(`[Audio] Tier 1b getUserMedia tracks: ${tracks.length}`, tracks.map(t => t.label))
            if (tracks.length > 0) {
              audioStream = new MediaStream(tracks)
              setAudioSource('system')
              console.log('[Audio] ✅ WASAPI loopback active (Tier 1b — IPC chromeMediaSource)')
            }
          }
        } catch (err) {
          if (currentId !== connectionIdRef.current) return
          console.warn('[Audio] ❌ Tier 1b IPC capture failed:', err)
        }
      }
    }

    // ── Tier 2: Stereo Mix / VB-Cable auto-detection ──────────────────────────
    if (!audioStream && !deviceId) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const loopback = devices.find(d =>
          d.kind === 'audioinput' &&
          /stereo mix|what u hear|wave out mix|loopback|vb-audio|vb-cable|cable output/i.test(d.label)
        )
        if (loopback) {
          audioStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: loopback.deviceId } }, video: false,
          })
          if (currentId !== connectionIdRef.current) { audioStream.getTracks().forEach(t => t.stop()); return }
          setAudioSource('system')
          console.log('[Audio] Loopback device (Tier 2):', loopback.label)
        }
      } catch (err) {
        if (currentId !== connectionIdRef.current) return
        console.warn('[Audio] Tier 2 Stereo Mix failed:', err)
      }
    }

    // ── Tier 3: Caller-specified deviceId (manual selection) ──────────────────
    if (!audioStream && deviceId) {
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: deviceId } }, video: false,
        })
        if (currentId !== connectionIdRef.current) { audioStream.getTracks().forEach(t => t.stop()); return }
        setAudioSource('system')
        console.log('[Audio] Specified device (Tier 3):', deviceId)
      } catch (err) {
        if (currentId !== connectionIdRef.current) return
        console.warn('[Audio] Tier 3 specified device failed:', err)
      }
    }

    // ── Tier 4: Default microphone fallback ───────────────────────────────────
    if (!audioStream) {
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        if (currentId !== connectionIdRef.current) { audioStream.getTracks().forEach(t => t.stop()); return }
        setAudioSource('microphone')
        console.log('[Audio] Default microphone (Tier 4 fallback)')
      } catch (err) {
        const error = err as Error
        if (currentId !== connectionIdRef.current) return
        onError?.(`Audio capture failed: ${error.message}`)
        updateStatus('idle')
        return
      }
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

    stopLevelMeter()

    recorderRef.current?.stop()
    recorderRef.current = null

    wsRef.current?.close()
    wsRef.current = null

    audioStreamRef.current?.getTracks().forEach((t) => t.stop())
    audioStreamRef.current = null

    setAudioSource(null)
    pendingTranscriptRef.current = ''
    audioQueueRef.current = []
    isProcessingRef.current = false

    updateStatus('idle')
  }, [updateStatus, stopLevelMeter])

  // Cleanup on unmount only.
  // Using [] instead of [stop] prevents the cleanup from re-running every time
  // stop() reference changes (which happens when updateStatus/onStatusChange re-creates).
  // Safe because stop() only accesses refs (wsRef, recorderRef...) which are always current.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => stop(), [])

  return { start, stop, status, audioSource, isMuted, toggleMute, audioLevel }
}
