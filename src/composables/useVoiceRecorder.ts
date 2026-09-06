import { onUnmounted, ref } from 'vue'

export const MAX_VOICE_SECONDS = 30

export function useVoiceRecorder(options: { onDenied?: () => void } = {}) {
  const recording = ref(false)
  const elapsed = ref(0)
  const voiceDraft = ref<File | null>(null)
  const voicePreviewUrl = ref<string | null>(null)

  let recorder: MediaRecorder | null = null
  let chunks: Blob[] = []
  let startedAt = 0
  let tick: ReturnType<typeof setInterval> | null = null
  let discardOnStop = false

  function pickRecorderMime() {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ]
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || ''
  }

  function voiceFile(parts: Blob[], recordedType: string) {
    const raw = ((recordedType || 'audio/webm').split(';')[0] ?? 'audio/webm').trim().toLowerCase()
    const type = raw.replace(/^video\//, 'audio/') || 'audio/webm'
    const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
    return new File([new Blob(parts, { type })], `voice.${ext}`, { type })
  }

  function formatVoiceTime(seconds: number) {
    const s = Math.min(MAX_VOICE_SECONDS, Math.max(0, Math.floor(seconds)))
    return `0:${String(s).padStart(2, '0')}`
  }

  function clearTick() {
    if (tick == null) return
    clearInterval(tick)
    tick = null
  }

  function stopRecording() {
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }

  function startTick() {
    startedAt = Date.now()
    elapsed.value = 0
    clearTick()
    tick = setInterval(() => {
      elapsed.value = (Date.now() - startedAt) / 1000
      if (elapsed.value >= MAX_VOICE_SECONDS) stopRecording()
    }, 200)
  }

  function clearVoiceDraft() {
    if (voicePreviewUrl.value) URL.revokeObjectURL(voicePreviewUrl.value)
    voicePreviewUrl.value = null
    voiceDraft.value = null
  }

  async function toggleRecord() {
    if (recording.value) {
      discardOnStop = false
      stopRecording()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunks = []
      discardOnStop = false
      const mime = pickRecorderMime()
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
      recorder.onstop = () => {
        clearTick()
        elapsed.value = 0
        stream.getTracks().forEach((track) => track.stop())
        recording.value = false
        if (discardOnStop || !chunks.length) return
        clearVoiceDraft()
        const file = voiceFile(chunks, recorder?.mimeType || mime || '')
        voiceDraft.value = file
        voicePreviewUrl.value = URL.createObjectURL(file)
      }
      recorder.start()
      recording.value = true
      startTick()
    } catch {
      options.onDenied?.()
    }
  }

  onUnmounted(() => {
    discardOnStop = true
    clearTick()
    stopRecording()
    clearVoiceDraft()
  })

  return {
    recording,
    elapsed,
    voiceDraft,
    voicePreviewUrl,
    MAX_VOICE_SECONDS,
    formatVoiceTime,
    toggleRecord,
    clearVoiceDraft,
  }
}
