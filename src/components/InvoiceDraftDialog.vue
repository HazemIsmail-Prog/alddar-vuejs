<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import { apiError } from '@/lib/utils'
import { blankInvoiceLine, invoiceLinesPayload, linesFromInvoice, type InvoiceEditLine } from '@/lib/invoiceLines'
import { orderDraftInvoice } from '@/lib/orderInvoices'
import { Button } from '@/components/ui/button'
import DeleteButton from '@/components/DeleteButton.vue'
import { Input } from '@/components/ui/input'
import Field from '@/components/ui/Field.vue'
import FormDialog from '@/components/FormDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import InvoiceLinesEditor from '@/components/InvoiceLinesEditor.vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  open: boolean
  orderId?: number | null
  invoiceId?: number | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
}>()

const { t } = useI18n()
const auth = useAuthStore()
const error = ref('')
const loading = ref(false)
const saving = ref(false)
const confirming = ref(false)
const invoice = ref<any>(null)
const order = ref<any>(null)
const catalog = ref<any[]>([])
const lines = ref<InvoiceEditLine[]>([])
const report = ref('')
const discount = ref('0')

const canPrice = computed(() => auth.can('invoices.confirm'))
const canConfirm = computed(() => auth.can('invoices.confirm'))
const canDelete = computed(() =>
  !!invoice.value?.id && invoice.value.status === 'draft' && auth.can('invoices.delete'),
)
const confirmOpen = ref(false)
const machines = computed(() => order.value?.location?.machines ?? [])
const coveredMachineIds = computed(() => (order.value?.contract?.machines || []).map((m: any) => Number(m.id)))
const title = computed(() =>
  invoice.value ? t('dispatch.invoiceTitle') : t('tech.createInvoice'),
)
const submitLabel = computed(() => {
  if (canConfirm.value) return t('dispatch.saveConfirm')
  return invoice.value ? t('tech.saveInvoice') : t('tech.createInvoice')
})

watch(() => props.open, async (open) => {
  if (!open) return
  error.value = ''
  await load()
})

async function load() {
  loading.value = true
  try {
    if (props.invoiceId) {
      invoice.value = (await api.get(`/api/invoices/${props.invoiceId}`)).data
      order.value = invoice.value.order
    } else if (props.orderId) {
      order.value = (await api.get(`/api/orders/${props.orderId}`)).data
      const draft = orderDraftInvoice(order.value)
      invoice.value = draft
      if (invoice.value?.id && !invoice.value.items) {
        invoice.value = (await api.get(`/api/invoices/${invoice.value.id}`)).data
        order.value = invoice.value.order
      }
    } else {
      invoice.value = null
      order.value = null
    }
    const departmentId = order.value?.department_id
    catalog.value = departmentId
      ? (await api.get('/api/items', { params: { department_id: departmentId, sellable: 1 } })).data
      : (await api.get('/api/items', { params: { sellable: 1 } })).data
    lines.value = invoice.value?.items?.length ? linesFromInvoice(invoice.value.items) : [blankInvoiceLine()]
    report.value = invoice.value?.report || ''
    discount.value = String(invoice.value?.discount ?? 0)
  } catch (e) {
    error.value = apiError(e)
  } finally {
    loading.value = false
  }
}

async function save(confirmInvoice: boolean) {
  if (saving.value) return
  error.value = ''
  const items = invoiceLinesPayload(lines.value, canPrice.value)
  if (!items.length) {
    error.value = t('dispatch.keepLine')
    return
  }
  if (!invoice.value && !report.value.trim()) {
    error.value = t('tech.needReport')
    return
  }
  const payload: Record<string, unknown> = {
    items,
    report: report.value.trim() || null,
  }
  if (canPrice.value) payload.discount = Number(discount.value)
  saving.value = true
  try {
    let current = invoice.value
    if (current?.id) {
      await api.put(`/api/invoices/${current.id}`, payload)
    } else {
      current = (await api.post(`/api/orders/${order.value.id}/invoice`, payload)).data
    }
    if (confirmInvoice && auth.can('invoices.confirm') && current?.id) {
      await api.post(`/api/invoices/${current.id}/confirm`)
    }
    emit('update:open', false)
    emit('saved')
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!invoice.value?.id || confirming.value) return
  error.value = ''
  confirming.value = true
  try {
    await api.delete(`/api/invoices/${invoice.value.id}`)
    confirmOpen.value = false
    emit('update:open', false)
    emit('saved')
  } catch (e) {
    error.value = apiError(e)
    confirmOpen.value = false
  } finally {
    confirming.value = false
  }
}
</script>

<template>
  <FormDialog
    :open="open"
    wide
    :title="title"
    :description="t('dispatch.invoiceDesc')"
    :submit-label="submitLabel"
    :loading="loading || saving"
    :error="error"
    @update:open="emit('update:open', $event)"
    @submit="save(canConfirm)"
  >
    <InvoiceLinesEditor
      v-model="lines"
      :catalog="catalog"
      :machines="machines"
      :covered-machine-ids="coveredMachineIds"
      :has-contract="!!order?.contract"
      :includes-spare-parts="!!order?.contract?.includes_spare_parts || order?.contract?.type === 'warranty'"
      :show-price="canPrice"
    />
    <Field :label="t('invoices.report')">
      <textarea v-model="report" class="textarea min-h-28" :placeholder="t('tech.reportPh')" />
    </Field>
    <Field v-if="canPrice" :label="t('common.discount')">
      <Input v-model="discount" type="number" min="0" step="1" />
    </Field>
    <template #footer>
      <DeleteButton v-if="canDelete" :disabled="loading || saving" @click="confirmOpen = true" />
      <div v-else />
      <div class="flex flex-wrap justify-end gap-2">
        <Button variant="outline" type="button" :disabled="loading || saving" @click="emit('update:open', false)">{{ t('common.cancel') }}</Button>
        <Button v-if="canConfirm" variant="outline" type="button" :disabled="loading" :loading="saving" @click="save(false)">{{ t('dispatch.saveDraft') }}</Button>
        <Button type="submit" :disabled="loading" :loading="saving">{{ submitLabel }}</Button>
      </div>
    </template>
  </FormDialog>

  <ConfirmDialog
    v-model:open="confirmOpen"
    :title="t('invoices.deleteTitle')"
    :description="t('invoices.deleteDesc')"
    :confirm-label="t('common.delete')"
    variant="destructive"
    :loading="confirming"
    @confirm="remove"
  />
</template>
