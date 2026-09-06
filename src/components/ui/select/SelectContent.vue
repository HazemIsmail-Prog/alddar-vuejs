<script setup lang="ts">
import { SelectContent, SelectPortal, SelectViewport } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{
  class?: string
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}>(), {
  align: 'start',
  sideOffset: 6,
})
</script>

<template>
  <SelectPortal>
    <SelectContent
      :align="props.align"
      :side-offset="props.sideOffset"
      position="popper"
      :class="cn(
        'z-[400] min-w-[8rem] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:text-slate-100',
        props.class,
      )"
    >
      <SelectViewport class="p-1">
        <slot />
      </SelectViewport>
    </SelectContent>
  </SelectPortal>
</template>
