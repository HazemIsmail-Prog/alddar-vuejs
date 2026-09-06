<script setup lang="ts">
import Template1 from './Template1.vue'
import Template2 from './Template2.vue'
import Template3 from './Template3.vue'

defineProps<{
  contract: any
  template: number
}>()

const emit = defineEmits<{
  ready: []
}>()
</script>

<template>
  <div class="contract-pdf block overflow-x-hidden print:bg-transparent" dir="rtl" lang="ar" style="--pdf-font: Calibri">
    <Template1 v-if="template === 1" :contract="contract" @ready="emit('ready')" />
    <Template2 v-else-if="template === 2" :contract="contract" @ready="emit('ready')" />
    <Template3 v-else :contract="contract" @ready="emit('ready')" />
  </div>
</template>
