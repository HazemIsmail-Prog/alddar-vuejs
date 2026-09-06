<script setup lang="ts">
defineProps<{
  label: string
}>()
</script>

<template>
  <section class="flex min-w-0 flex-col gap-1.5">
    <h3 class="px-0.5 text-xs font-medium text-slate-500">{{ label }}</h3>
    <div class="flex flex-wrap items-center gap-2">
      <slot />
    </div>
  </section>
</template>
