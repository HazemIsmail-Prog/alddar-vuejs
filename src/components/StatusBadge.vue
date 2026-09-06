<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { cn, statusBadgeStyle } from '@/lib/utils'
import { statusName } from '@/i18n'
import { useStatusStore } from '@/stores/statuses'

const props = defineProps<{ status?: string | null; class?: string }>()
const { locale } = useI18n()
const statuses = useStatusStore()
const record = computed(() => statuses.meta(props.status))
const label = computed(() => {
  void locale.value
  return statusName(record.value, props.status)
})
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
    :class="cn(props.class)"
    :style="statusBadgeStyle(record?.color)"
  >
    {{ label }}
  </span>
</template>
