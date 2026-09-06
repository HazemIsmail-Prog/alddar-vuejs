<script setup lang="ts">
import { Download } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'

defineProps<{
  disabled?: boolean
  loading?: boolean
  size?: 'default' | 'sm'
}>()

const emit = defineEmits<{
  click: []
}>()

const { t } = useI18n()
</script>

<template>
  <Button variant="outline" :size="size" :disabled="disabled" :loading="loading" @click="emit('click')">
    <Download class="size-4" /> {{ t('common.exportPdf') }}
  </Button>
</template>
