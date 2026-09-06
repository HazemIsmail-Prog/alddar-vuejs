<script setup lang="ts">
import { cn } from '@/lib/utils'
const props = withDefaults(defineProps<{ class?: string; variant?: 'default' | 'secondary' | 'outline' }>(), {
  variant: 'default',
})
</script>
<template>
  <span
    :class="
      cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variant === 'default' && 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900',
        variant === 'secondary' && 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-white',
        variant === 'outline' && 'border border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200',
        props.class,
      )
    "
  >
    <slot />
  </span>
</template>
