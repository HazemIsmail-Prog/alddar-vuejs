import { ref } from 'vue'
import { attachmentObjectUrl } from '@/lib/attachments'
import type { AttachmentRecord } from '@/types/attachment'

export function isPlayableAudio(file: Pick<AttachmentRecord, 'kind' | 'mime' | 'original_name'>) {
  if (file.kind === 'audio') return true
  const mime = String(file.mime || '').toLowerCase()
  const name = String(file.original_name || '').toLowerCase()
  return mime.startsWith('audio/') || mime === 'video/webm' || mime === 'video/ogg' || /\.(webm|m4a|mp3|ogg|wav|aac)$/.test(name)
}

export function useAttachmentMedia() {
  const mediaUrls = ref<Record<number, string>>({})
  const mediaLoading = ref<Record<number, boolean>>({})
  const mediaReady = ref<Record<number, boolean>>({})
  const mediaFailed = ref<Record<number, boolean>>({})

  async function loadMedia(rows: { attachments?: AttachmentRecord[] }[]) {
    const attachments = rows.flatMap((row) => row.attachments || []).filter((file) =>
      file.kind === 'image' || isPlayableAudio(file),
    )
    await Promise.allSettled(attachments.map(async (file) => {
      if (mediaUrls.value[file.id] || mediaLoading.value[file.id]) return
      mediaLoading.value[file.id] = true
      try {
        mediaUrls.value[file.id] = await attachmentObjectUrl(file.id)
      } catch {
        mediaFailed.value[file.id] = true
      } finally {
        mediaLoading.value[file.id] = false
      }
    }))
  }

  function markMediaReady(id: number) {
    mediaReady.value = { ...mediaReady.value, [id]: true }
  }

  function markMediaFailed(id: number) {
    mediaFailed.value = { ...mediaFailed.value, [id]: true }
  }

  return {
    mediaUrls,
    mediaLoading,
    mediaReady,
    mediaFailed,
    isPlayableAudio,
    loadMedia,
    markMediaReady,
    markMediaFailed,
  }
}
