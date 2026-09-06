<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  tabs: {
    id: string
    label: string
    badge?: number
    completed?: number
    cancelled?: number
    completedHref?: string
    cancelledHref?: string
  }[]
}>()

const { t } = useI18n()
const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="page-tabs" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      role="tab"
      class="page-tab inline-flex items-center gap-1.5"
      :class="model === tab.id && 'is-active'"
      :aria-selected="model === tab.id"
      @click="model = tab.id"
    >
      {{ tab.label }}
      <span
        v-if="tab.badge"
        class="min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 font-medium text-white"
      >{{ tab.badge > 99 ? '99+' : tab.badge }}</span>
      <a
        v-if="tab.completed && tab.completedHref"
        :href="tab.completedHref"
        target="_blank"
        rel="noopener noreferrer"
        class="rounded-full bg-emerald-600 px-1.5 text-[10px] leading-4 font-medium tabular-nums text-white hover:bg-emerald-700"
        :title="t('dispatch.completedToday', { n: tab.completed })"
        @click.stop
      >{{ t('dispatch.completedToday', { n: tab.completed }) }}</a>
      <span
        v-else-if="tab.completed"
        class="rounded-full bg-emerald-600 px-1.5 text-[10px] leading-4 font-medium tabular-nums text-white"
        :title="t('dispatch.completedToday', { n: tab.completed })"
      >{{ t('dispatch.completedToday', { n: tab.completed }) }}</span>
      <a
        v-if="tab.cancelled && tab.cancelledHref"
        :href="tab.cancelledHref"
        target="_blank"
        rel="noopener noreferrer"
        class="rounded-full bg-slate-500 px-1.5 text-[10px] leading-4 font-medium tabular-nums text-white hover:bg-slate-600"
        :title="t('dispatch.cancelledToday', { n: tab.cancelled })"
        @click.stop
      >{{ t('dispatch.cancelledToday', { n: tab.cancelled }) }}</a>
      <span
        v-else-if="tab.cancelled"
        class="rounded-full bg-slate-500 px-1.5 text-[10px] leading-4 font-medium tabular-nums text-white"
        :title="t('dispatch.cancelledToday', { n: tab.cancelled })"
      >{{ t('dispatch.cancelledToday', { n: tab.cancelled }) }}</span>
    </button>
  </div>
</template>
