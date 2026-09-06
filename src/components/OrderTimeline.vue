<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { cn } from '@/lib/utils'
import { personName } from '@/i18n'
import { useStatusStore } from '@/stores/statuses'
import EmptyState from '@/components/EmptyState.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const props = defineProps<{
  items?: any[] | null
  compact?: boolean
  class?: string
}>()

const { t, locale } = useI18n()
const statuses = useStatusStore()

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function dayKey(value?: string | null) {
  const date = parseDate(value)
  if (!date) return 'unknown'
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function fmtDay(key: string) {
  if (key === 'unknown') return t('common.dash')
  const [year = 0, month = 1, day = 1] = key.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - date.getTime()) / 86_400_000)
  if (diff === 0) return t('common.today')
  if (diff === 1) return t('common.yesterday')
  return date.toLocaleDateString(locale.value === 'ar' ? 'ar' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
}

function fmtTime(value?: string | null) {
  const date = parseDate(value)
  if (!date) return ''
  return date.toLocaleTimeString(locale.value === 'ar' ? 'ar' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const groups = computed(() => {
  void locale.value
  const buckets = new Map<string, any[]>()
  for (const row of [...(props.items || [])].reverse()) {
    const key = dayKey(row.created_at)
    const list = buckets.get(key)
    if (list) list.push(row)
    else buckets.set(key, [row])
  }
  return [...buckets.entries()].map(([key, items]) => ({
    key,
    label: fmtDay(key),
    items,
  }))
})

function color(slug?: string | null) {
  return statuses.meta(slug)?.color || '#94a3b8'
}

function actorLabel(row: any) {
  return row?.from_status ? t('orders.changedBy') : t('orders.createdBy')
}
</script>

<template>
  <p v-if="!groups.length && compact" class="text-sm text-slate-400">{{ t('orders.noTimeline') }}</p>
  <EmptyState v-else-if="!groups.length" :title="t('orders.noTimeline')" />
  <div v-else :class="cn(compact ? 'space-y-4' : 'space-y-5', props.class)">
    <section v-for="(group, groupIndex) in groups" :key="group.key">
      <h3 class="mb-2 text-xs font-medium tracking-wide text-slate-400">{{ group.label }}</h3>
      <ol class="ms-0.5">
        <li
          v-for="(row, index) in group.items"
          :key="row.id ?? index"
          class="flex gap-3"
          :class="index < group.items.length - 1 ? (compact ? 'pb-4' : 'pb-5') : ''"
        >
          <div class="flex w-4 shrink-0 flex-col items-center" aria-hidden="true">
            <span
              class="relative z-10 mt-1.5 shrink-0 rounded-full ring-[3px] ring-white dark:ring-[#151c2c]"
              :class="groupIndex === 0 && index === 0 ? 'size-3' : 'size-2.5'"
              :style="{ backgroundColor: color(row.to_status) }"
            />
            <span
              v-if="index < group.items.length - 1"
              class="mt-1 w-px flex-1 bg-slate-200 dark:bg-slate-700"
            />
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-3">
              <StatusBadge :status="row.to_status" />
              <time
                v-if="row.created_at"
                class="shrink-0 pt-0.5 text-end text-xs tabular-nums text-slate-400"
                :datetime="row.created_at"
              >
                {{ fmtTime(row.created_at) }}
              </time>
            </div>

            <dl class="mt-1.5 space-y-0.5 text-sm">
              <div v-if="row.user" class="flex flex-wrap items-baseline gap-x-2">
                <dt class="text-slate-400">{{ actorLabel(row) }}</dt>
                <dd class="font-medium text-slate-700 dark:text-slate-200">{{ personName(row.user) }}</dd>
              </div>
              <div v-if="row.technician" class="flex flex-wrap items-baseline gap-x-2">
                <dt class="text-slate-400">{{ t('orders.assignedTo') }}</dt>
                <dd class="font-medium text-slate-700 dark:text-slate-200">{{ personName(row.technician) }}</dd>
              </div>
            </dl>

            <p
              v-if="row.reason"
              class="mt-2 border-s-2 border-slate-200 ps-2.5 text-sm leading-relaxed text-slate-500 dark:border-slate-600"
            >
              {{ row.reason }}
            </p>
          </div>
        </li>
      </ol>
    </section>
  </div>
</template>
