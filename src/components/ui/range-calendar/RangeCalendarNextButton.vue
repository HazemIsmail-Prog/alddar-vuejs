<script setup lang="ts">
import type { RangeCalendarNextProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { ChevronRight } from '@lucide/vue'
import { reactiveOmit } from '@vueuse/core'
import { RangeCalendarNext, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

const props = defineProps<RangeCalendarNextProps & { class?: HTMLAttributes['class'] }>()
const forwarded = useForwardProps(reactiveOmit(props, 'class'))
</script>

<template>
  <RangeCalendarNext
    data-slot="range-calendar-next-button"
    :class="cn(buttonVariants({ variant: 'outline' }), 'absolute end-1 size-7 bg-transparent p-0 opacity-50 hover:opacity-100', props.class)"
    v-bind="forwarded"
  >
    <slot>
      <ChevronRight class="size-4" />
    </slot>
  </RangeCalendarNext>
</template>
