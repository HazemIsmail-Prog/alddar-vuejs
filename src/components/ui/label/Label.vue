<script setup lang="ts">
import { Label } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<{
  for?: string
  class?: string
}>()
</script>

<template>
  <Label :for="props.for" :class="cn('text-sm font-medium leading-none text-slate-700 dark:text-slate-200', props.class)">
    <slot />
  </Label>
</template>
