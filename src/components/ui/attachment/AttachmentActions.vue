<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="attachment-actions"
    :class="cn(
      'relative z-30 flex shrink-0 items-center group-data-[orientation=vertical]/attachment:absolute group-data-[orientation=vertical]/attachment:top-1.5 group-data-[orientation=vertical]/attachment:end-1.5 group-data-[orientation=vertical]/attachment:gap-1',
      props.class,
    )"
  >
    <slot />
  </div>
</template>
