<script setup lang="ts">
import { Separator } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{
  orientation?: 'horizontal' | 'vertical'
  class?: string
}>(), { orientation: 'horizontal' })
</script>

<template>
  <Separator
    :orientation="props.orientation"
    :class="cn(
      'shrink-0 bg-slate-200 dark:bg-slate-700',
      props.orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      props.class,
    )"
  />
</template>
