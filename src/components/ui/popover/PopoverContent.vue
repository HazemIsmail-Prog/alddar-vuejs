<script setup lang="ts">
import { useAttrs } from 'vue'
import { PopoverContent, PopoverPortal } from 'reka-ui'
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  class?: string
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
}>(), {
  align: 'start',
  side: 'bottom',
  sideOffset: 6,
})

const attrs = useAttrs()
</script>

<template>
  <PopoverPortal>
    <PopoverContent
      v-bind="attrs"
      :align="props.align"
      :side="props.side"
      :side-offset="props.sideOffset"
      :class="cn(
        'z-[400] w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg outline-none dark:border-slate-700 dark:text-slate-100',
        props.class,
      )"
    >
      <slot />
    </PopoverContent>
  </PopoverPortal>
</template>

