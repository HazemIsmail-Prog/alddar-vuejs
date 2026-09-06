<script setup lang="ts">
import { cn } from '@/lib/utils'
const props = defineProps<{ class?: string; type?: string; modelValue?: string | number }>()
const emit = defineEmits(['update:modelValue'])
</script>
<template>
  <input
    :type="type ?? 'text'"
    :value="modelValue"
    :class="cn('flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 dark:border-slate-700 dark:bg-[#151c2c] dark:text-slate-100', props.class)"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
