<script setup lang="ts">
import { useSlots } from 'vue'
import { useI18n } from 'vue-i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const props = defineProps<{
  open: boolean
  title: string
  description?: string
  wide?: boolean
  submitLabel?: string
  loading?: boolean
  error?: string
  hideSubmit?: boolean
  destructive?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: []
}>()

const { t } = useI18n()
const slots = useSlots()

function onOpenChange(value: boolean) {
  if (props.loading && !value) return
  emit('update:open', value)
}

function onSubmit() {
  if (props.loading) return
  if (props.hideSubmit) {
    emit('update:open', false)
    return
  }
  emit('submit')
}
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent
      :class="cn('flex max-h-[90vh] flex-col overflow-hidden p-0', wide ? 'max-w-4xl' : 'max-w-lg')"
    >
      <DialogHeader class="shrink-0 px-5 pt-5">
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription v-if="description">{{ description }}</DialogDescription>
        <slot name="header-extra" />
      </DialogHeader>
      <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="onSubmit">
        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div class="grid gap-3">
            <slot />
          </div>
        </div>
        <p v-if="error" class="shrink-0 px-5 pb-2 text-sm text-red-600 dark:text-red-400">{{ error }}</p>
        <DialogFooter
          :class="cn(
            'mt-0 shrink-0 border-t border-slate-200 px-5 py-3 dark:border-slate-700',
            slots.footer && 'w-full justify-between',
          )"
        >
          <slot name="footer">
            <Button variant="outline" type="button" :disabled="loading" @click="emit('update:open', false)">
              {{ hideSubmit ? t('common.close') : t('common.cancel') }}
            </Button>
            <Button
              v-if="!hideSubmit"
              type="submit"
              :variant="destructive ? 'destructive' : 'default'"
              :loading="loading"
            >
              {{ submitLabel ?? t('common.save') }}
            </Button>
          </slot>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
