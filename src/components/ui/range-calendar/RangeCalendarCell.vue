<script setup lang="ts">
import type { RangeCalendarCellProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { RangeCalendarCell, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<RangeCalendarCellProps & { class?: HTMLAttributes['class'] }>()
const forwarded = useForwardProps(reactiveOmit(props, 'class'))
</script>

<template>
  <RangeCalendarCell
    data-slot="range-calendar-cell"
    :class="cn(
      'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
      '[&:has([data-selected])]:bg-slate-100 first:[&:has([data-selected])]:rounded-s-md last:[&:has([data-selected])]:rounded-e-md',
      '[&:has([data-selected][data-outside-view])]:bg-slate-100/50',
      '[&:has([data-selected][data-selection-end])]:rounded-e-md [&:has([data-selected][data-selection-start])]:rounded-s-md',
      'dark:[&:has([data-selected])]:bg-white/10',
      props.class,
    )"
    v-bind="forwarded"
  >
    <slot />
  </RangeCalendarCell>
</template>
