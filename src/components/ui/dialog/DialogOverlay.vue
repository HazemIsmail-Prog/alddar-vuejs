<script setup lang="ts">
import { DialogOverlay } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <DialogOverlay :class="cn('dialog-overlay-lock', props.class)" />
</template>
