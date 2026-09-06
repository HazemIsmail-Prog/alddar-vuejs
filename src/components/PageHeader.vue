<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ChevronLeft } from '@lucide/vue'

defineProps<{
  title: string
  subtitle?: string
  backTo?: string
  backLabel?: string
}>()
</script>

<template>
  <header class="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
    <div class="min-w-0">
      <RouterLink
        v-if="backTo"
        :to="backTo"
        class="mb-1 inline-flex items-center gap-0.5 text-xs font-medium text-accent hover:underline"
      >
        <ChevronLeft class="size-3.5 rtl:rotate-180" />
        {{ backLabel }}
      </RouterLink>
      <slot name="eyebrow" />
      <h1 class="text-2xl font-semibold tracking-tight">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 text-sm text-slate-500">{{ subtitle }}</p>
      <slot name="meta" />
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2 sm:justify-end">
      <slot name="actions" />
    </div>
  </header>
</template>
