<script setup lang="ts">
import type { ChartConfig } from '.'

const props = defineProps<{
  config?: ChartConfig
  payload?: Record<string, unknown>
  labelFormatter?: (value: unknown) => string
}>()

function entries() {
  const data = props.payload || {}
  return Object.entries(data)
    .filter(([key]) => key !== 'date' && key !== 'label' && key !== 'name')
    .map(([key, value]) => ({
      key,
      label: props.config?.[key]?.label || key,
      color: props.config?.[key] && 'color' in props.config[key] ? props.config[key].color : '#0f766e',
      value,
    }))
}

function title() {
  const data = props.payload || {}
  const raw = data.date ?? data.label ?? data.name
  if (props.labelFormatter) return props.labelFormatter(raw)
  if (raw instanceof Date) return raw.toLocaleDateString()
  return raw == null ? '' : String(raw)
}
</script>

<template>
  <div class="min-w-36 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 shadow-md dark:border-slate-600 dark:text-slate-100">
    <p v-if="title()" class="mb-1 text-[11px] font-medium text-slate-500">{{ title() }}</p>
    <div v-for="row in entries()" :key="row.key" class="flex items-center justify-between gap-4 text-xs">
      <span class="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
        <span class="size-2 rounded-[2px]" :style="{ background: row.color }" />
        {{ row.label }}
      </span>
      <span class="font-medium tabular-nums">{{ row.value }}</span>
    </div>
  </div>
</template>
