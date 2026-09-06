<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { usePdfStore, type ContractTemplateId } from '@/stores/pdf'

const { t } = useI18n()
const pdf = usePdfStore()
const { picker } = storeToRefs(pdf)

const templates: { id: ContractTemplateId; label: string; hint: string }[] = [
  { id: 1, label: 'Template 1', hint: 'صيانة غير شامل قطع الغيار' },
  { id: 2, label: 'Template 2', hint: 'صيانة شامل قطع الغيار بدون الكمبريسور' },
  { id: 3, label: 'Template 3', hint: 'طلب تشغيل وكفالة كمبريسور' },
]

function onOpenChange(open: boolean) {
  if (!open) pdf.closeContractPicker()
}
</script>

<template>
  <Dialog :open="!!picker" @update:open="onOpenChange">
    <DialogContent raised class="max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t('common.exportPdf') }}</DialogTitle>
        <DialogDescription>{{ picker?.title }}</DialogDescription>
      </DialogHeader>
      <div class="grid gap-2">
        <Button
          v-for="item in templates"
          :key="item.id"
          variant="outline"
          class="h-auto justify-start py-3"
          @click="pdf.printPickedTemplate(item.id)"
        >
          <span class="flex flex-col items-start gap-0.5 text-start">
            <span>{{ item.label }}</span>
            <span class="text-xs font-normal text-slate-500" dir="rtl" lang="ar">{{ item.hint }}</span>
          </span>
        </Button>
      </div>
      <DialogFooter>
        <Button variant="outline" type="button" @click="pdf.closeContractPicker()">{{ t('common.cancel') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
