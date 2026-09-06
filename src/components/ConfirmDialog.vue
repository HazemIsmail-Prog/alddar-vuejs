<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const props = defineProps<{
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  variant?: 'default' | 'destructive'
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()

const { t } = useI18n()

function onOpenChange(value: boolean) {
  if (props.loading && !value) return
  emit('update:open', value)
}
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent raised class="max-w-md">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription v-if="description">{{ description }}</DialogDescription>
      </DialogHeader>
      <slot />
      <DialogFooter>
        <Button variant="outline" type="button" :disabled="loading" @click="emit('update:open', false)">{{ t('common.cancel') }}</Button>
        <Button :variant="variant ?? 'default'" :loading="loading" @click="loading ? undefined : emit('confirm')">
          {{ confirmLabel ?? t('common.confirm') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
