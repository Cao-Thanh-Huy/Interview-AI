import { useCallback, useEffect, useRef, useState } from 'react'
import type { AudioSource } from '@/lib/types'

interface UseAudioCaptureReturn {
  stream: MediaStream | null
  source: AudioSource
  audioLevel: number
}

/**
 * useAudioCapture — quản lý WASAPI loopback capture xuyên suốt vòng đời app.
 *
 * - Audio stream được acquire 1 lần khi mount, giữ sống đến unmount.
 * - KHÔNG restart stream giữa các sessions → tránh WASAPI release race.
 * - Level meter (AudioContext + AnalyserNode) gắn với stream cố định.
 * - Tier 4 (microphone) được loại bỏ vì nguy hiểm cho interview use case.
 */
export function useAudioCapture(): UseAudioCaptureReturn {
  const [audioLevel, setAudioLevel] = useState(0)
  const [source, setSource] = useState<AudioSource>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)  // state để trigger re-render

  const streamRef = useRef<MediaStream | null>(null)

  // AudioContext & level meter
  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const levelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Level meter: start / stop ─────────────────────────────────────────────
  const stopLevelMeter = useCallback(() => {
    if (levelTimerRef.current) {
      clearInterval(levelTimerRef.current)
      levelTimerRef.current = null
    }
    analyserRef.current = null
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect()
      sourceNodeRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    setAudioLevel(0)
  }, [])

  const startLevelMeter = useCallback((stream: MediaStream) => {
    // Close old context nếu có (safety net)
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    try {
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      ctx.resume().then(() => console.log('[Audio] AudioContext state:', ctx.state))
    } catch {
      return  // AudioContext not supported
    }
    try {
      const ctx = audioCtxRef.current!
      const source = ctx.createMediaStreamSource(stream)
      sourceNodeRef.current = source
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
      }
      levelTimerRef.current = setInterval(tick, 200)
    } catch {
      // Analyser not supported
    }
  }, [])

  // ── Audio acquisition tiers ─────────────────────────────────────────────
  const acquire = useCallback(async (): Promise<MediaStream | null> => {
    if (streamRef.current) return streamRef.current  // already acquired

    const isElectron = !!(window as unknown as { electronAudio?: unknown }).electronAudio
    let audioStream: MediaStream | null = null

    // Tier 1a: getDisplayMedia → Electron WASAPI loopback
    if (isElectron) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        stream.getVideoTracks().forEach(t => t.stop())
        const tracks = stream.getAudioTracks()
        console.log(`[Audio] getDisplayMedia returned ${tracks.length} audio track(s)`, tracks.map(t => t.label))
        if (tracks.length > 0) {
          audioStream = new MediaStream(tracks)
          setSource('system')
          console.log('[Audio] ✅ WASAPI loopback active (Tier 1a)')
        } else {
          console.warn('[Audio] Tier 1a: 0 audio tracks')
        }
      } catch (err) {
        console.warn('[Audio] Tier 1a getDisplayMedia failed:', err)
      }

      // Tier 1b: IPC requestDisplayCapture fallback
      if (!audioStream) {
        try {
          const electronAudio = (window as unknown as { electronAudio?: { requestDisplayCapture: () => Promise<string | null> } }).electronAudio
          const sourceId = await electronAudio?.requestDisplayCapture()
          if (sourceId) {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                // @ts-expect-error — Electron-specific constraint
                mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId },
              },
              video: false,
            })
            const tracks = stream.getAudioTracks()
            if (tracks.length > 0) {
              audioStream = new MediaStream(tracks)
              setSource('system')
              console.log('[Audio] ✅ WASAPI loopback active (Tier 1b)')
            }
          }
        } catch (err) {
          console.warn('[Audio] Tier 1b IPC capture failed:', err)
        }
      }
    }

    // Tier 2: Stereo Mix / VB-Cable auto-detection
    if (!audioStream) {
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
          setSource('system')
          console.log('[Audio] Loopback device (Tier 2):', loopback.label)
        }
      } catch (err) {
        console.warn('[Audio] Tier 2 Stereo Mix failed:', err)
      }
    }

    // KHÔNG fallback xuống microphone — nguy hiểm cho interview use case.
    // Nếu không capture được system audio, báo lỗi để user kiểm tra.
    if (!audioStream) {
      console.error('[Audio] ❌ All system audio capture tiers failed.')
      console.error('[Audio]   → Không fallback xuống microphone (sẽ capture user voice, sai interview use case)')
      console.error('[Audio]   → User cần kiểm tra: (1) WASAPI loopback enabled? (2) Speakers đang bật?')
    }

    if (audioStream) {
      streamRef.current = audioStream
      setStream(audioStream)  // trigger re-render để useDeepgram nhận stream
      startLevelMeter(audioStream)
    }

    return audioStream
  }, [startLevelMeter])

  // Acquire 1 lần khi mount, release khi unmount
  useEffect(() => {
    acquire()
    return () => {
      stopLevelMeter()
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      setStream(null)
    }
  }, [acquire, stopLevelMeter])

  return {
    stream,
    source,
    audioLevel,
  }
}
