<script setup lang="ts">
import { cn } from '@/lib/utils'
const props = defineProps<{ class?: string }>()
</script>
<template>
  <div :class="cn('mt-5 flex flex-wrap justify-end gap-2', props.class)">
    <slot />
  </div>
</template>
