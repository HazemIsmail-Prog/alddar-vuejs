<script setup lang="ts">
import type { RangeCalendarGridProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { RangeCalendarGrid, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<RangeCalendarGridProps & { class?: HTMLAttributes['class'] }>()
const forwarded = useForwardProps(reactiveOmit(props, 'class'))
</script>

<template>
  <RangeCalendarGrid
    data-slot="range-calendar-grid"
    :class="cn('w-full border-collapse space-y-1', props.class)"
    v-bind="forwarded"
  >
    <slot />
  </RangeCalendarGrid>
</template>
