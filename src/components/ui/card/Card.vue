<script setup lang="ts">
import { cn } from '@/lib/utils'
const props = defineProps<{ class?: string }>()
</script>
<template>
  <div :class="cn('rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700', props.class)">
    <slot />
  </div>
</template>
