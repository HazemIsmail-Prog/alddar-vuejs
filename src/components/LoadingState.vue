<script setup lang="ts">
import { LoaderCircle } from '@lucide/vue'
import { useI18n } from 'vue-i18n'

withDefaults(defineProps<{
  overlay?: boolean
  label?: string
}>(), {
  overlay: false,
})

const { t } = useI18n()
</script>

<template>
  <div
    :class="overlay
      ? 'absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 dark:bg-[#0b1220]/70'
      : 'rounded-xl border border-slate-200 bg-white px-5 py-12 text-center dark:border-slate-700'"
    role="status"
    :aria-busy="true"
  >
    <div class="flex flex-col items-center gap-2">
      <LoaderCircle class="size-6 animate-spin text-accent" />
      <p class="text-sm text-slate-500">{{ label || t('common.loading') }}</p>
    </div>
  </div>
</template>
