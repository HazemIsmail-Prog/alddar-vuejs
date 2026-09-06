<script setup lang="ts">
import type { RangeCalendarHeaderProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { RangeCalendarHeader, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<RangeCalendarHeaderProps & { class?: HTMLAttributes['class'] }>()
const forwarded = useForwardProps(reactiveOmit(props, 'class'))
</script>

<template>
  <RangeCalendarHeader
    data-slot="range-calendar-header"
    :class="cn('relative flex w-full items-center justify-center pt-1', props.class)"
    v-bind="forwarded"
  >
    <slot />
  </RangeCalendarHeader>
</template>
