<script setup lang="ts">
import type { RangeCalendarGridRowProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { RangeCalendarGridRow, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<RangeCalendarGridRowProps & { class?: HTMLAttributes['class'] }>()
const forwarded = useForwardProps(reactiveOmit(props, 'class'))
</script>

<template>
  <RangeCalendarGridRow
    data-slot="range-calendar-grid-row"
    :class="cn('mt-2 w-full', props.class)"
    v-bind="forwarded"
  >
    <slot />
  </RangeCalendarGridRow>
</template>
