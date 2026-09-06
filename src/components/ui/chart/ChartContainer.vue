<script setup lang="ts">
import { computed, toRef, useId } from 'vue'
import { cn } from '@/lib/utils'
import { provideChartContext, type ChartConfig } from '.'
import ChartStyle from './ChartStyle.vue'

const props = defineProps<{
  config: ChartConfig
  class?: string
  id?: string
}>()

const uid = useId()
const chartId = computed(() => `chart-${String(props.id || uid).replace(/:/g, '')}`)

provideChartContext({
  id: chartId.value,
  config: toRef(props, 'config'),
})
</script>

<template>
  <div
    dir="ltr"
    :data-chart="chartId"
    :class="cn('flex w-full flex-col justify-center text-xs [&_.vis-xy-container]:h-[220px] [&_.vis-single-container]:h-[220px]', props.class)"
  >
    <ChartStyle :id="chartId" :config="config" />
    <slot />
  </div>
</template>
