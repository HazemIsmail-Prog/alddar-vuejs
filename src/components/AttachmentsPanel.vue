<script setup lang="ts">
import { computed, onMounted, ref, watch, type Component } from 'vue'
import { Archive, File, FileSpreadsheet, FileText, LoaderCircle, Paperclip, Volume2, X } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import { apiError } from '@/lib/utils'
import { attachmentObjectUrl, downloadAttachment, forgetAttachmentUrl } from '@/lib/attachments'
import { Button } from '@/components/ui/button'
import SearchField from '@/components/SearchField.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from '@/components/ui/attachment'
import { useAuthStore } from '@/stores/auth'
import { useStaffReload } from '@/composables/useStaffEvent'
import { personName } from '@/i18n'
import LoadingState from '@/components/LoadingState.vue'
import type { AttachmentRecord } from '@/types/attachment'

const props = defineProps<{ type: string; id: number; hideTitle?: boolean }>()
const { t } = useI18n()
const auth = useAuthStore()
const files = ref<AttachmentRecord[]>([])
const query = ref('')
const error = ref('')
const loading = ref(true)
const uploading = ref(false)
const pending = ref<string[]>([])
const previews = ref<Record<number, string>>({})
const inputEl = ref<HTMLInputElement | null>(null)
const pendingDelete = ref<AttachmentRecord | null>(null)
const removing = ref(false)
const confirmOpen = computed({
  get: () => !!pendingDelete.value,
  set: (open: boolean) => {
    if (!open && !removing.value) pendingDelete.value = null
  },
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return files.value
  return files.value.filter((file) =>
    `${file.original_name || ''} ${personName(file.user)} ${file.user?.name_en || ''} ${file.user?.name_ar || ''} ${file.kind || ''} ${file.mime || ''}`.toLowerCase().includes(q),
  )
})

const images = computed(() => filtered.value.filter((file) => file.kind === 'image'))
const others = computed(() => filtered.value.filter((file) => file.kind !== 'image'))

async function load() {
  if (!props.id) {
    files.value = []
    loading.value = false
    return
  }
  try {
    files.value = (await api.get(`/api/${props.type}/${props.id}/attachments`)).data
    for (const file of files.value.filter((f) => f.kind === 'image')) {
      previews.value[file.id] = await attachmentObjectUrl(file.id)
    }
  } finally {
    loading.value = false
  }
}

async function upload(event: Event) {
  const picked = Array.from((event.target as HTMLInputElement).files || [])
  ;(event.target as HTMLInputElement).value = ''
  if (!picked.length || uploading.value) return
  uploading.value = true
  pending.value = picked.map((file) => file.name)
  error.value = ''
  try {
    const data = new FormData()
    picked.forEach((file) => data.append('files[]', file))
    await api.post(`/api/${props.type}/${props.id}/attachments`, data)
    await load()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    pending.value = []
    uploading.value = false
  }
}

function askRemove(file: AttachmentRecord) {
  pendingDelete.value = file
}

async function confirmRemove() {
  const file = pendingDelete.value
  if (!file) return
  removing.value = true
  error.value = ''
  try {
    await api.delete(`/api/attachments/${file.id}`)
    forgetAttachmentUrl(file.id)
    pendingDelete.value = null
    await load()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    removing.value = false
  }
}

function canDelete(file: AttachmentRecord) {
  return file.user?.id === auth.user?.id
}

function fileMeta(file: AttachmentRecord) {
  const ext = String(file.original_name || '').split('.').pop()?.toUpperCase() || String(file.kind || 'FILE').toUpperCase()
  const bytes = Number(file.size) || 0
  const size = bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${ext} · ${size}`
}

function fileIcon(file: AttachmentRecord): Component {
  const name = String(file.original_name || '').toLowerCase()
  const mime = String(file.mime || '')
  if (file.kind === 'audio' || mime.startsWith('audio/')) return Volume2
  if (mime.includes('pdf') || name.endsWith('.pdf')) return FileText
  if (mime.includes('zip') || name.endsWith('.zip')) return Archive
  if (mime.includes('sheet') || mime.includes('excel') || name.endsWith('.xlsx') || name.endsWith('.xls')) return FileSpreadsheet
  return File
}

watch(() => [props.type, props.id], () => {
  query.value = ''
  files.value = []
  loading.value = true
  load()
})
onMounted(load)

useStaffReload(
  (e) => e.kind === 'conversation' && e.action !== 'read' && e.type === props.type && Number(e.id) === Number(props.id),
  load,
)
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <p v-if="!hideTitle" class="me-auto text-sm font-medium">{{ t('comments.files') }}</p>
      <SearchField
        v-if="files.length"
        v-model="query"
        class="min-w-0 flex-1 [&_input]:sm:w-full"
        :placeholder="t('comments.searchFiles')"
      />
      <div>
        <input ref="inputEl" type="file" multiple class="hidden" @change="upload" />
        <Button type="button" size="sm" variant="outline" :loading="uploading" @click="inputEl?.click()">
          <Paperclip class="size-3.5" /> {{ t('comments.upload') }}
        </Button>
      </div>
    </div>
    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    <div class="relative">
    <LoadingState v-if="loading && !files.length && !pending.length" />
    <p v-else-if="!files.length && !pending.length" class="text-sm text-slate-400">{{ t('comments.noFiles') }}</p>
    <p v-else-if="!filtered.length && !pending.length" class="text-sm text-slate-400">{{ t('common.noResults') }}</p>
    <div v-else class="flex flex-col gap-3">
      <AttachmentGroup v-if="images.length" class="w-full">
        <template v-for="file in images" :key="file.id">
          <Attachment orientation="vertical">
            <AttachmentMedia variant="image">
              <img v-if="previews[file.id]" :src="previews[file.id]" :alt="file.original_name">
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{{ file.original_name }}</AttachmentTitle>
              <AttachmentDescription>{{ fileMeta(file) }}</AttachmentDescription>
            </AttachmentContent>
            <AttachmentTrigger
              type="button"
              :aria-label="t('comments.downloadFile', { name: file.original_name })"
              @click="downloadAttachment(file.id, file.original_name)"
            />
            <AttachmentActions>
              <AttachmentAction
                v-if="canDelete(file)"
                class="bg-white/95 text-slate-700 shadow-sm hover:bg-white dark:bg-slate-900/90 dark:text-slate-100"
                :aria-label="t('comments.removeFile', { name: file.original_name })"
                @click.stop="askRemove(file)"
              >
                <X />
              </AttachmentAction>
            </AttachmentActions>
          </Attachment>
        </template>
      </AttachmentGroup>

      <Attachment v-for="name in pending" :key="`pending-${name}`" state="uploading" class="w-full">
        <AttachmentMedia>
          <LoaderCircle class="size-4 animate-spin" />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{{ name }}</AttachmentTitle>
          <AttachmentDescription>{{ t('comments.uploading') }}</AttachmentDescription>
        </AttachmentContent>
      </Attachment>

      <Attachment v-for="file in others" :key="file.id" class="w-full">
        <AttachmentMedia>
          <component :is="fileIcon(file)" />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{{ file.original_name }}</AttachmentTitle>
          <AttachmentDescription>{{ fileMeta(file) }}</AttachmentDescription>
        </AttachmentContent>
        <AttachmentTrigger
          type="button"
          :aria-label="t('comments.downloadFile', { name: file.original_name })"
          @click="downloadAttachment(file.id, file.original_name)"
        />
        <AttachmentActions>
          <AttachmentAction
            v-if="canDelete(file)"
            :aria-label="t('comments.removeFile', { name: file.original_name })"
            @click.stop="askRemove(file)"
          >
            <X />
          </AttachmentAction>
        </AttachmentActions>
      </Attachment>
    </div>
    <LoadingState v-if="loading && files.length" overlay />
    </div>
    <ConfirmDialog
      v-model:open="confirmOpen"
      :title="t('comments.deleteFileTitle', { name: pendingDelete?.original_name })"
      :description="t('comments.deleteFileDesc')"
      :confirm-label="t('common.delete')"
      variant="destructive"
      :loading="removing"
      @confirm="confirmRemove"
    />
  </div>
</template>
