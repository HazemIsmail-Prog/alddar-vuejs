<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Button } from '@/components/ui/button'

const props = withDefaults(defineProps<{
  class?: HTMLAttributes['class']
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'danger'
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-xs'
}>(), {
  variant: 'ghost',
  size: 'icon-xs',
})
</script>

<template>
  <Button
    type="button"
    data-slot="attachment-action"
    class="relative z-30"
    :variant="variant"
    :size="size"
    :class="props.class"
  >
    <slot />
  </Button>
</template>
