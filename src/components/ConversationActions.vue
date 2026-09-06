<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { MessageCircle, Paperclip } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import CommentsThread from '@/components/CommentsThread.vue'
import AttachmentsPanel from '@/components/AttachmentsPanel.vue'
import { useInboxStore } from '@/stores/inbox'

const props = withDefaults(defineProps<{
  type: string
  id: number | string | null
  size?: 'default' | 'sm'
  startWith?: 'comments' | 'files' | ''
  followHash?: boolean
  hideButtons?: boolean
}>(), { size: 'default', startWith: '', followHash: true, hideButtons: false })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const inbox = useInboxStore()
const { threads } = storeToRefs(inbox)
const commentsOpen = ref(false)
const filesOpen = ref(false)

const recordId = computed(() => Number(props.id) || 0)
const unread = computed(() =>
  threads.value.find((thread) => thread.type === props.type && Number(thread.id) === recordId.value)?.unread || 0,
)

function openFromRoute() {
  if (!recordId.value) return
  if (props.startWith === 'comments' || (props.followHash && route.hash === '#comments')) commentsOpen.value = true
  if (props.startWith === 'files' || (props.followHash && route.hash === '#files')) filesOpen.value = true
}

watch(() => props.startWith, openFromRoute)
watch(() => route.hash, (hash, prev) => {
  if (hash === '#comments' && prev !== '#comments') commentsOpen.value = true
  if (hash === '#files' && prev !== '#files') filesOpen.value = true
})
watch(recordId, (id, prev) => {
  if (id === prev) return
  commentsOpen.value = false
  filesOpen.value = false
})
onMounted(openFromRoute)

function clearHash(hash: string) {
  if (route.hash !== hash) return
  void router.replace({ query: route.query, hash: '' })
}

function setCommentsOpen(open: boolean) {
  commentsOpen.value = open
  if (!open) clearHash('#comments')
}

function setFilesOpen(open: boolean) {
  filesOpen.value = open
  if (!open) clearHash('#files')
}

function openComments() {
  setCommentsOpen(true)
}

function openFiles() {
  setFilesOpen(true)
}

defineExpose({ openComments, openFiles })
</script>

<template>
  <div v-if="recordId" :class="hideButtons ? '' : 'flex flex-wrap items-center gap-2'">
    <template v-if="!hideButtons">
      <Button type="button" variant="outline" :size="size" @click="setCommentsOpen(true)">
        <MessageCircle class="size-3.5" />
        {{ t('comments.title') }}
        <span v-if="unread" class="rounded-full bg-red-600 px-1.5 text-[10px] leading-4 text-white">{{ unread }}</span>
      </Button>
      <Button type="button" variant="outline" :size="size" @click="setFilesOpen(true)">
        <Paperclip class="size-3.5" />
        {{ t('comments.files') }}
      </Button>
    </template>

    <Dialog :open="commentsOpen" @update:open="setCommentsOpen">
      <DialogContent raised class="flex max-h-[90vh] flex-col overflow-hidden p-0 md:max-w-xl">
        <DialogHeader class="shrink-0 px-5 pt-5 pb-3">
          <DialogTitle>{{ t('comments.title') }}</DialogTitle>
        </DialogHeader>
        <div class="min-h-0 flex-1 overflow-hidden px-5 pb-5">
          <CommentsThread v-if="commentsOpen" :type="type" :id="recordId" class="h-[min(70vh,36rem)]" />
        </div>
      </DialogContent>
    </Dialog>

    <Dialog :open="filesOpen" @update:open="setFilesOpen">
      <DialogContent raised class="flex max-h-[90vh] flex-col overflow-hidden p-0 md:max-w-xl">
        <DialogHeader class="shrink-0 px-5 pt-5 pb-3">
          <DialogTitle>{{ t('comments.files') }}</DialogTitle>
        </DialogHeader>
        <div class="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <AttachmentsPanel v-if="filesOpen" :type="type" :id="recordId" hide-title />
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
