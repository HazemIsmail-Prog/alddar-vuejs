<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { paginateIntoLetterhead } from '@/lib/letterheadSheet'

const props = withDefaults(
  defineProps<{
    dir?: 'rtl' | 'ltr'
    lang?: string
  }>(),
  { dir: 'ltr' },
)

const emit = defineEmits<{
  ready: []
}>()

const sourceRef = ref<HTMLElement | null>(null)
const pagesRef = ref<HTMLElement | null>(null)

onMounted(async () => {
  await nextTick()
  const source = sourceRef.value
  const pages = pagesRef.value
  if (source && pages) {
    await paginateIntoLetterhead(source, pages, {
      dir: props.dir,
      lang: props.lang,
      fontSize: '12px',
      lineHeight: '1.45',
    })
  }
  emit('ready')
})
</script>

<template>
  <div class="letterhead-pages">
    <div ref="sourceRef" class="hidden w-[210mm] print:hidden">
      <slot />
    </div>
    <div ref="pagesRef"></div>
  </div>
</template>
