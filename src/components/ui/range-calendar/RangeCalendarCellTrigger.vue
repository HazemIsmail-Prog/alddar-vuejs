<script setup lang="ts">
import type { RangeCalendarCellTriggerProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { RangeCalendarCellTrigger, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

const props = defineProps<RangeCalendarCellTriggerProps & { class?: HTMLAttributes['class'] }>()
const forwarded = useForwardProps(reactiveOmit(props, 'class'))
</script>

<template>
  <RangeCalendarCellTrigger
    data-slot="range-calendar-cell-trigger"
    :class="cn(
      buttonVariants({ variant: 'ghost' }),
      'size-8 p-0 font-normal data-[selected]:opacity-100',
      '[&[data-today]:not([data-selected])]:bg-slate-100 [&[data-today]:not([data-selected])]:text-slate-900',
      'data-[selection-start]:bg-accent data-[selection-start]:text-white',
      'data-[selection-start]:hover:bg-accent data-[selection-start]:hover:text-white',
      'data-[selection-end]:bg-accent data-[selection-end]:text-white',
      'data-[selection-end]:hover:bg-accent data-[selection-end]:hover:text-white',
      'data-[outside-view]:text-slate-400 data-[outside-view]:opacity-50',
      'data-[disabled]:text-slate-400 data-[disabled]:opacity-50',
      'data-[unavailable]:text-red-600 data-[unavailable]:line-through',
      props.class,
    )"
    v-bind="forwarded"
  >
    <slot />
  </RangeCalendarCellTrigger>
</template>
