<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  amount?: number | string | null
}>()

const { t } = useI18n()
const value = computed(() => Number(props.amount || 0))
</script>

<template>
  <div v-if="value > 0" class="min-w-0 text-end">
    <p class="text-[0.7rem] font-medium tracking-wider text-slate-500 uppercase">{{ t('clients.netDue') }}</p>
    <p class="mt-0.5 text-sm font-semibold tabular-nums text-amber-800 dark:text-amber-200">{{ value }}</p>
  </div>
</template>
