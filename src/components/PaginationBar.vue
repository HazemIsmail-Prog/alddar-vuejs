<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  page: number
  lastPage: number
}>()

const emit = defineEmits<{
  'update:page': [value: number]
}>()

const { t } = useI18n()

function go(next: number) {
  emit('update:page', next)
}
</script>

<template>
  <div v-if="lastPage > 1" class="mt-3 flex items-center justify-end gap-2 text-sm">
    <Button size="sm" variant="outline" :disabled="page <= 1" @click="go(page - 1)">{{ t('common.previous') }}</Button>
    <span class="text-slate-500">{{ t('common.pageOf', { page, last: lastPage }) }}</span>
    <Button size="sm" variant="outline" :disabled="page >= lastPage" @click="go(page + 1)">{{ t('common.next') }}</Button>
  </div>
</template>
