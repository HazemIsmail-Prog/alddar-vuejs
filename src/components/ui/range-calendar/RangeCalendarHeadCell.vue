<script setup lang="ts">
import type { RangeCalendarHeadCellProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { RangeCalendarHeadCell, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<RangeCalendarHeadCellProps & { class?: HTMLAttributes['class'] }>()
const forwarded = useForwardProps(reactiveOmit(props, 'class'))
</script>

<template>
  <RangeCalendarHeadCell
    data-slot="range-calendar-head-cell"
    :class="cn('w-8 rounded-md text-[0.8rem] font-normal text-slate-500', props.class)"
    v-bind="forwarded"
  >
    <slot />
  </RangeCalendarHeadCell>
</template>
