<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <span
    data-slot="attachment-title"
    :class="cn(
      'block max-w-full min-w-0 truncate font-medium group-data-[state=processing]/attachment:animate-pulse group-data-[state=uploading]/attachment:animate-pulse',
      props.class,
    )"
  >
    <slot />
  </span>
</template>
