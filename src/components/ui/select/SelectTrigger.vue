<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { SelectIcon, SelectTrigger } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <SelectTrigger
    :class="cn(
      'inline-flex h-8 items-center justify-between gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-sm shadow-sm',
      'focus:outline-none focus:ring-2 focus:ring-accent/30',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'dark:border-slate-600 dark:bg-transparent dark:text-slate-100',
      props.class,
    )"
  >
    <slot />
    <SelectIcon as-child>
      <ChevronDown class="size-3.5 opacity-60" />
    </SelectIcon>
  </SelectTrigger>
</template>
