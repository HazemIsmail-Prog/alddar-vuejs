<script setup lang="ts">
import type { RangeCalendarHeadingProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { RangeCalendarHeading, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<RangeCalendarHeadingProps & { class?: HTMLAttributes['class'] }>()
const forwarded = useForwardProps(reactiveOmit(props, 'class'))
</script>

<template>
  <RangeCalendarHeading
    v-slot="{ headingValue }"
    data-slot="range-calendar-heading"
    :class="cn('text-sm font-medium', props.class)"
    v-bind="forwarded"
  >
    <slot :heading-value="headingValue">
      {{ headingValue }}
    </slot>
  </RangeCalendarHeading>
</template>
