<script setup lang="ts">
import { computed } from 'vue'
import type { ChartConfig } from '.'

const props = defineProps<{
  id: string
  config: ChartConfig
}>()

const css = computed(() => {
  const vars = Object.entries(props.config)
    .map(([key, item]) => {
      const color = 'color' in item ? item.color : item.theme?.light
      return color ? `--color-${key}:${color};` : ''
    })
    .join('')
  return `[data-chart="${props.id}"]{${vars}}`
})
</script>

<template>
  <component :is="'style'">{{ css }}</component>
</template>
