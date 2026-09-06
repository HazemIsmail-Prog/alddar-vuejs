<script setup lang="ts">
import { useChart } from '.'

const { config } = useChart()
</script>

<template>
  <div class="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1">
    <div v-for="(item, key) in config" :key="String(key)" class="inline-flex items-center gap-1.5">
      <span class="size-2 rounded-[2px]" :style="{ background: 'color' in item ? item.color : item.theme?.light }" />
      <span class="text-[11px] text-slate-500">{{ item.label || key }}</span>
    </div>
  </div>
</template>
