<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { CircleAlert, LoaderCircle, Mic, Paperclip, Send, Square, X } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import { apiError, cn } from '@/lib/utils'
import { downloadAttachment } from '@/lib/attachments'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { useInboxStore } from '@/stores/inbox'
import { useStaffReload } from '@/composables/useStaffEvent'
import { useVoiceRecorder } from '@/composables/useVoiceRecorder'
import { useAttachmentMedia } from '@/composables/useAttachmentMedia'
import { personName } from '@/i18n'
import type { AttachmentRecord } from '@/types/attachment'
import type { CommentPage, CommentRecord } from '@/types/comments'

const props = defineProps<{ type: string; id: number; class?: string }>()
const { t } = useI18n()
const auth = useAuthStore()
const inbox = useInboxStore()

const comments = ref<CommentRecord[]>([])
const hasMore = ref(false)
const loadingOlder = ref(false)
const body = ref('')
const files = ref<File[]>([])
const error = ref('')
const listEl = ref<HTMLElement | null>(null)
const pinned = ref(true)
let nextTempId = -1
const fileEl = ref<HTMLInputElement | null>(null)
const lightbox = ref<string | null>(null)

const {
  recording,
  elapsed,
  voiceDraft,
  voicePreviewUrl,
  MAX_VOICE_SECONDS,
  formatVoiceTime,
  toggleRecord: startOrStopRecord,
  clearVoiceDraft,
} = useVoiceRecorder({ onDenied: () => { error.value = t('comments.micDenied') } })

const {
  mediaUrls,
  mediaReady,
  mediaFailed,
  isPlayableAudio,
  loadMedia,
  markMediaReady,
  markMediaFailed,
} = useAttachmentMedia()

function isPending(comment: CommentRecord) {
  return comment.id < 0
}

function tempId() {
  const id = nextTempId
  nextTempId -= 1
  return id
}

function fileKind(file: File) {
  if (file.type.startsWith('image/')) return 'image'
  if (isPlayableAudio({ kind: 'file', mime: file.type, original_name: file.name })) return 'audio'
  return 'file'
}

function pendingAttachments(picked: File[]) {
  const attachments: AttachmentRecord[] = []
  picked.forEach((file) => {
    const id = tempId()
    const kind = fileKind(file)
    attachments.push({
      id,
      kind,
      original_name: file.name,
      mime: file.type || 'application/octet-stream',
      size: file.size,
    })
    if (kind === 'image' || isPlayableAudio({ kind, mime: file.type, original_name: file.name })) {
      const url = URL.createObjectURL(file)
      mediaUrls.value = { ...mediaUrls.value, [id]: url }
      if (kind === 'image') markMediaReady(id)
    }
  })
  return attachments
}

function handoffPendingMedia(pending: CommentRecord, created: CommentRecord) {
  const pendingFiles = pending.attachments || []
  const nextUrls = { ...mediaUrls.value }
  const nextReady = { ...mediaReady.value }
  for (const [index, file] of (created.attachments || []).entries()) {
    const previous = pendingFiles[index]
    if (!previous) continue
    const url = nextUrls[previous.id]
    if (url) {
      nextUrls[file.id] = url
      delete nextUrls[previous.id]
    }
    if (nextReady[previous.id]) {
      nextReady[file.id] = true
      delete nextReady[previous.id]
    }
  }
  mediaUrls.value = nextUrls
  mediaReady.value = nextReady
}

function needsMediaLoad(comment: CommentRecord) {
  return (comment.attachments || []).some((file) =>
    (file.kind === 'image' || isPlayableAudio(file)) && !mediaUrls.value[file.id],
  )
}

function confirmPending(pendingId: number, pending: CommentRecord, created: CommentRecord) {
  handoffPendingMedia(pending, created)
  const alreadyThere = comments.value.some((comment) => comment.id === created.id)
  comments.value = comments.value.flatMap((comment) => {
    if (comment.id !== pendingId) return [comment]
    return alreadyThere ? [] : [created]
  })
}

function pendingMatches(pending: CommentRecord, created: CommentRecord) {
  return created.user?.id === pending.user?.id
    && (created.body || '') === (pending.body || '')
    && (created.attachments?.length || 0) === (pending.attachments?.length || 0)
}

function leftoverPending(data: CommentRecord[], pending: CommentRecord[]) {
  const leftover: CommentRecord[] = []
  const claimed = new Set<number>()
  for (const row of pending) {
    const match = data.find((comment) => !claimed.has(comment.id) && pendingMatches(row, comment))
    if (match) {
      claimed.add(match.id)
      handoffPendingMedia(row, match)
    } else {
      leftover.push(row)
    }
  }
  return leftover
}

function revokePendingMedia(comment: CommentRecord) {
  for (const file of comment.attachments || []) {
    if (file.id >= 0) continue
    const url = mediaUrls.value[file.id]
    if (url) URL.revokeObjectURL(url)
    const next = { ...mediaUrls.value }
    delete next[file.id]
    mediaUrls.value = next
  }
}

function revokeAllPendingMedia() {
  comments.value.filter(isPending).forEach(revokePendingMedia)
}

function nearBottom() {
  const el = listEl.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight <= 64
}

function onListScroll() {
  pinned.value = nearBottom()
}

async function scrollToBottom(opts?: { force?: boolean }) {
  if (!opts?.force && !pinned.value) return
  await nextTick()
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
}

function onMediaLaidOut() {
  void scrollToBottom()
}

function onAudioCanPlay(id: number) {
  markMediaReady(id)
  void scrollToBottom()
}

async function fetchPage(before?: number) {
  const { data } = await api.get(`/api/${props.type}/${props.id}/comments`, {
    params: before ? { before } : {},
  })
  return data as CommentPage
}

function mergeLatest(incoming: CommentRecord[]) {
  const byId = new Map(comments.value.filter((comment) => comment.id > 0).map((comment) => [comment.id, comment]))
  for (const row of incoming) byId.set(row.id, row)
  const persisted = [...byId.values()].sort((a, b) => a.id - b.id)
  return [...persisted, ...leftoverPending(incoming, comments.value.filter(isPending))]
}

async function load(opts?: { reset?: boolean }) {
  if (!props.id) return
  const reset = Boolean(opts?.reset) || !comments.value.some((comment) => comment.id > 0)
  const previousIds = comments.value.map((comment) => comment.id).join(',')
  const previousScroll = listEl.value?.scrollTop ?? 0
  const known = new Set(comments.value.map((comment) => comment.id))
  const page = await fetchPage()
  if (reset) {
    comments.value = [...page.comments, ...leftoverPending(page.comments, comments.value.filter(isPending))]
    hasMore.value = page.has_more
  } else {
    comments.value = mergeLatest(page.comments)
  }
  if (!previousIds) pinned.value = true
  await nextTick()
  if (listEl.value) {
    if (pinned.value || !previousIds) {
      await scrollToBottom({ force: !previousIds })
    } else {
      listEl.value.scrollTop = previousScroll
    }
  }
  const mediaRows = reset
    ? page.comments
    : page.comments.filter((comment) => !known.has(comment.id))
  await loadMedia(mediaRows)
  if (pinned.value) await scrollToBottom()
}

async function loadOlder() {
  if (!props.id || loadingOlder.value || !hasMore.value) return
  const oldest = comments.value.find((comment) => comment.id > 0)
  if (!oldest) return
  loadingOlder.value = true
  try {
    const el = listEl.value
    const prevHeight = el?.scrollHeight ?? 0
    const prevTop = el?.scrollTop ?? 0
    const page = await fetchPage(oldest.id)
    const existing = new Set(comments.value.map((comment) => comment.id))
    const fresh = page.comments.filter((comment) => !existing.has(comment.id))
    comments.value = [...fresh, ...comments.value]
    hasMore.value = page.has_more
    await nextTick()
    if (el) el.scrollTop = prevTop + (el.scrollHeight - prevHeight)
    await loadMedia(fresh)
    if (el) el.scrollTop = prevTop + (el.scrollHeight - prevHeight)
  } catch (e) {
    error.value = apiError(e)
  } finally {
    loadingOlder.value = false
  }
}

async function markRead() {
  if (!props.id) return
  await api.post(`/api/${props.type}/${props.id}/comments/read`)
  await inbox.load()
}

async function send() {
  const payload = [
    ...(voiceDraft.value ? [voiceDraft.value] : []),
    ...files.value,
  ]
  const text = body.value.trim()
  if (recording.value || (!text && !payload.length)) return

  const data = new FormData()
  if (text) data.append('body', text)
  if (voiceDraft.value) data.append('kind', 'voice')
  payload.forEach((file) => data.append('files[]', file))

  const pendingId = tempId()
  const pending: CommentRecord = {
    id: pendingId,
    kind: voiceDraft.value ? 'voice' : text ? 'text' : 'file',
    body: text || null,
    created_at: new Date().toISOString(),
    user: auth.user
      ? { id: auth.user.id, name_en: auth.user.name_en, name_ar: auth.user.name_ar }
      : null,
    attachments: pendingAttachments(payload),
    read_by: [],
  }

  comments.value = [...comments.value, pending]
  body.value = ''
  files.value = []
  clearVoiceDraft()
  error.value = ''
  pinned.value = true
  await scrollToBottom({ force: true })

  try {
    const created = (await api.post(`/api/${props.type}/${props.id}/comments`, data)).data as CommentRecord
    confirmPending(pendingId, pending, created)
    if (needsMediaLoad(created)) await loadMedia([created])
    if (pinned.value) await scrollToBottom()
    void inbox.load()
  } catch (e) {
    revokePendingMedia(pending)
    comments.value = comments.value.filter((comment) => comment.id !== pendingId)
    error.value = apiError(e)
    if (!body.value.trim() && text) body.value = text
  }
}

function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  files.value = [...files.value, ...Array.from(input.files || [])]
  input.value = ''
}

function toggleRecord() {
  return startOrStopRecord()
}

function own(comment: CommentRecord) {
  return comment.user?.id === auth.user?.id
}

function time(value?: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleString()
}

watch(() => [props.type, props.id] as const, async (curr, prev) => {
  if (prev) inbox.unwatchThread(prev[0], Number(prev[1]))
  inbox.watchThread(curr[0], Number(curr[1]))
  revokeAllPendingMedia()
  comments.value = []
  error.value = ''
  hasMore.value = false
  pinned.value = true
  try {
    await load({ reset: true })
    await markRead()
  } catch (e) {
    error.value = apiError(e)
  }
})

onMounted(async () => {
  inbox.watchThread(props.type, props.id)
  try {
    await load({ reset: true })
    await markRead()
  } catch (e) {
    error.value = apiError(e)
  }
})

useStaffReload(
  (e) => e.kind === 'conversation' && e.type === props.type && Number(e.id) === Number(props.id),
  async (e) => {
    await load()
    if (e.action !== 'read') await markRead()
  },
)

onUnmounted(() => {
  revokeAllPendingMedia()
  inbox.unwatchThread(props.type, props.id)
})
</script>

<template>
  <div :class="cn('flex min-h-80 flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700', props.class)">
    <div ref="listEl" class="min-h-52 flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3 dark:bg-slate-900/40" @scroll="onListScroll">
      <div v-if="hasMore" class="flex justify-center py-1">
        <Button variant="ghost" size="sm" :loading="loadingOlder" @click="loadOlder">
          {{ loadingOlder ? t('comments.loadingOlder') : t('comments.showOlder') }}
        </Button>
      </div>
      <p v-if="!comments.length" class="py-8 text-center text-sm text-slate-400">{{ t('comments.empty') }}</p>
      <div
        v-for="comment in comments"
        :key="comment.id"
        class="flex"
        :class="own(comment) ? 'justify-end' : 'justify-start'"
      >
        <div
          class="max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm"
          :class="own(comment) ? 'rounded-ee-md bg-accent text-white' : 'rounded-es-md bg-white dark:bg-slate-800'"
        >
          <p v-if="!own(comment)" class="mb-0.5 text-[11px] font-medium opacity-80">{{ personName(comment.user) }}</p>
          <p v-if="comment.body" class="whitespace-pre-wrap">{{ comment.body }}</p>
          <div v-if="comment.attachments?.length" class="mt-1 space-y-1.5">
            <template v-for="file in comment.attachments" :key="file.id">
              <button v-if="file.kind === 'image' && mediaUrls[file.id]" type="button" class="block overflow-hidden rounded-lg" @click="lightbox = mediaUrls[file.id] ?? null">
                <img :src="mediaUrls[file.id]" :alt="file.original_name" class="max-h-48 max-w-full object-cover" @load="onMediaLaidOut" />
              </button>
              <div v-else-if="isPlayableAudio(file)" class="min-w-[12rem]">
                <div
                  v-if="mediaFailed[file.id]"
                  class="flex items-start gap-1.5 text-xs"
                  :class="own(comment) ? 'text-red-100' : 'text-red-600 dark:text-red-400'"
                >
                  <CircleAlert class="mt-0.5 size-3.5 shrink-0" />
                  <span>{{ t('comments.voiceMissing') }}</span>
                </div>
                <div v-else>
                  <div
                    v-if="!mediaReady[file.id]"
                    class="flex items-center gap-2 py-1 text-xs opacity-80"
                  >
                    <LoaderCircle class="size-4 shrink-0 animate-spin" />
                    {{ t('comments.loadingVoice') }}
                  </div>
                  <audio
                    v-if="mediaUrls[file.id]"
                    :src="mediaUrls[file.id]"
                    controls
                    preload="auto"
                    class="max-w-full"
                    :class="mediaReady[file.id] ? '' : 'sr-only'"
                    @canplay="onAudioCanPlay(file.id)"
                    @error="markMediaFailed(file.id)"
                  />
                </div>
              </div>
              <button v-else-if="file.id > 0" type="button" class="flex items-center gap-1 underline" @click="downloadAttachment(file.id, file.original_name)">
                {{ file.original_name }}
              </button>
              <span v-else>{{ file.original_name }}</span>
            </template>
          </div>
          <p class="mt-1 text-[10px] opacity-70">
            <template v-if="isPending(comment)">{{ t('comments.sending') }}</template>
            <template v-else>
              {{ time(comment.created_at) }}
              <span v-if="own(comment) && comment.read_by?.length"> · {{ t('comments.seenBy', { names: comment.read_by.map((u) => personName(u)).join(', ') }) }}</span>
            </template>
          </p>
        </div>
      </div>
    </div>
    <p v-if="error" class="px-3 pt-2 text-xs text-red-600">{{ error }}</p>
    <div v-if="files.length" class="flex flex-wrap gap-1 border-t border-slate-200 px-3 py-2 text-xs dark:border-slate-700">
      <span v-for="(file, i) in files" :key="i" class="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{{ file.name }}</span>
    </div>
    <div v-if="voiceDraft && voicePreviewUrl" class="flex items-center gap-2 border-t border-slate-200 px-3 py-2 dark:border-slate-700">
      <audio :src="voicePreviewUrl" controls class="h-8 min-w-0 flex-1" />
      <Button type="button" size="icon" variant="ghost" :title="t('comments.discardVoice')" @click="clearVoiceDraft">
        <X class="size-4" />
      </Button>
    </div>
    <div class="flex items-end gap-2 border-t border-slate-200 p-2 dark:border-slate-700">
      <input ref="fileEl" type="file" multiple class="hidden" @change="onPick" />
      <Button type="button" size="icon" variant="ghost" :title="t('comments.attach')" :disabled="recording" @click="fileEl?.click()">
        <Paperclip class="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        :variant="recording ? 'destructive' : 'ghost'"
        :title="recording ? t('comments.stopVoice') : t('comments.voice')"
        @click="toggleRecord"
      >
        <Square v-if="recording" class="size-3.5 fill-current" />
        <Mic v-else class="size-4" />
      </Button>
      <span v-if="recording" class="mb-2 tabular-nums text-xs font-medium text-red-600 dark:text-red-400">
        {{ formatVoiceTime(elapsed) }} / {{ formatVoiceTime(MAX_VOICE_SECONDS) }}
      </span>
      <textarea
        v-model="body"
        rows="1"
        class="textarea min-h-9 flex-1 resize-none"
        :placeholder="t('comments.placeholder')"
        :disabled="recording"
        @keydown.enter.exact.prevent="send()"
      />
      <Button type="button" size="icon" :disabled="recording || (!body.trim() && !files.length && !voiceDraft)" @click="send()">
        <Send class="size-4" />
      </Button>
    </div>
    <div v-if="lightbox" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" @click="lightbox = null">
      <img :src="lightbox" class="max-h-full max-w-full rounded-lg" />
    </div>
  </div>
</template>

