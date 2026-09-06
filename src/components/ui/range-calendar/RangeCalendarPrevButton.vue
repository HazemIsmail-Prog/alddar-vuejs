<script setup lang="ts">
import type { RangeCalendarPrevProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { ChevronLeft } from '@lucide/vue'
import { reactiveOmit } from '@vueuse/core'
import { RangeCalendarPrev, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

const props = defineProps<RangeCalendarPrevProps & { class?: HTMLAttributes['class'] }>()
const forwarded = useForwardProps(reactiveOmit(props, 'class'))
</script>

<template>
  <RangeCalendarPrev
    data-slot="range-calendar-prev-button"
    :class="cn(buttonVariants({ variant: 'outline' }), 'absolute start-1 size-7 bg-transparent p-0 opacity-50 hover:opacity-100', props.class)"
    v-bind="forwarded"
  >
    <slot>
      <ChevronLeft class="size-4" />
    </slot>
  </RangeCalendarPrev>
</template>
