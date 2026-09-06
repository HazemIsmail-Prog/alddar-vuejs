<script setup lang="ts">
import { Search } from '@lucide/vue'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

defineProps<{
  placeholder?: string
  class?: string
}>()

const model = defineModel<string>({ default: '' })
</script>

<template>
  <div :class="cn('relative', $props.class)">
    <Search class="pointer-events-none absolute top-2.5 start-2.5 size-4 text-slate-400" />
    <Input v-model="model" class="w-full ps-8 sm:w-56" :placeholder="placeholder" />
  </div>
</template>
