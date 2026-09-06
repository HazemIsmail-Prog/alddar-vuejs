<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="px-5 py-12 text-center">
    <div
      v-if="$slots.icon"
      class="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800"
    >
      <slot name="icon" />
    </div>
    <p class="font-medium">{{ title }}</p>
    <p v-if="description" class="mx-auto mt-1 max-w-sm text-sm text-slate-500">{{ description }}</p>
    <div v-if="$slots.action" class="mt-4 flex justify-center">
      <slot name="action" />
    </div>
  </div>
</template>
