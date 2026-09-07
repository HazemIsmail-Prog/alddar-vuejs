<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Plus, Wallet } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import { apiError, fmtDate, remainingAmountClass } from '@/lib/utils'
import { named, personName } from '@/i18n'
import { machineLabel } from '@/lib/machines'
import { paymentMethodLabel } from '@/lib/payments'
import { invoiceCanDelete, invoicePaidAmount, invoiceRemaining } from '@/lib/orderInvoices'
import { Button } from '@/components/ui/button'
import DeleteButton from '@/components/DeleteButton.vue'
import InvoiceDraftDialog from '@/components/InvoiceDraftDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageHeader from '@/components/PageHeader.vue'
import { Badge } from '@/components/ui/badge'
import ConversationActions from '@/components/ConversationActions.vue'
import PdfExportButton from '@/components/PdfExportButton.vue'
import EmptyState from '@/components/EmptyState.vue'
import ReceivePaymentDialog, { type PaymentDue } from '@/components/ReceivePaymentDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useStaffReload } from '@/composables/useStaffEvent'
import { useReceivePayment } from '@/composables/useReceivePayment'
import { usePdfStore } from '@/stores/pdf'
import LoadingState from '@/components/LoadingState.vue'

const { t } = useI18n()
const auth = useAuthStore()
const pdf = usePdfStore()
const route = useRoute()
const router = useRouter()
const { payOpen, payMode, payPreset, openReceive: receive, openApply: apply } = useReceivePayment()

type InvoiceAllocation = {
  id: number
  amount: number
  method?: string | null
  payment_id?: number | null
  payment?: { id?: number; method?: string | null; notes?: string | null; receiver?: { name_en?: string | null; name_ar?: string | null } | null }
  applier?: { name_en?: string | null; name_ar?: string | null } | null
  created_at?: string | null
}

const invoice = ref<any>(null)
const editorOpen = ref(false)
const confirmOpen = ref(false)
const error = ref('')
const confirming = ref(false)
const loading = ref(true)

const canDelete = computed(() => auth.can('invoices.delete') && invoiceCanDelete(invoice.value, true))
const paid = computed(() => invoicePaidAmount(invoice.value))
const remaining = computed(() => invoiceRemaining(invoice.value))
const wallet = computed(() => Number(invoice.value?.order?.client?.wallet || 0))
const allocations = computed<InvoiceAllocation[]>(() => invoice.value?.allocations || [])
const isConfirmed = computed(() => invoice.value?.status === 'confirmed')
const canReceive = computed(() => auth.can('payments.collect') && isConfirmed.value)
const canApply = computed(() => canReceive.value && wallet.value > 0 && remaining.value > 0)
const canCollect = computed(() => canReceive.value && remaining.value > 0)

const dues = computed<PaymentDue[]>(() => {
  if (!invoice.value || remaining.value <= 0) return []
  return [{
    type: 'invoice',
    id: invoice.value.id,
    remaining: remaining.value,
    label: t('clients.forInvoice', { id: invoice.value.id }),
  }]
})

function openReceive() {
  receive(
    remaining.value > 0 && invoice.value
      ? { type: 'invoice', id: invoice.value.id }
      : { type: 'credit' },
  )
}

function openApply() {
  if (!invoice.value) return
  apply({ type: 'invoice', id: invoice.value.id })
}

async function load(quiet = false) {
  if (!quiet) loading.value = true
  try {
    invoice.value = (await api.get(`/api/invoices/${route.params.id}`)).data
  } finally {
    if (!quiet) loading.value = false
  }
}

async function exportDetail() {
  if (!invoice.value) return
  await pdf.print({
    kind: 'invoice-detail',
    title: t('pdf.invoice', { id: invoice.value.id }),
    filename: `invoice-${invoice.value.id}`,
    data: { invoice: invoice.value },
  })
}

async function exportReceipt(row: InvoiceAllocation) {
  const id = row.payment_id || row.payment?.id || row.id
  await pdf.print({
    kind: 'payment-receipt',
    title: t('pdf.receipt', { id }),
    filename: `payment-${id}`,
    data: {
      client: invoice.value?.order?.client,
      payment: {
        ...(row.payment || row),
        amount: row.amount,
        allocations: [row],
      },
    },
  })
}

async function remove() {
  if (confirming.value) return
  error.value = ''
  confirming.value = true
  try {
    await api.delete(`/api/invoices/${invoice.value.id}`)
    confirmOpen.value = false
    await router.push('/invoices')
  } catch (e) {
    error.value = apiError(e)
    confirmOpen.value = false
  } finally {
    confirming.value = false
  }
}

onMounted(() => { void load() })

useStaffReload((e) => {
  const inv = invoice.value
  if (!inv) return false
  if (e.kind === 'order') return Number(e.order_id) === Number(inv.order_id)
  if (e.kind === 'client') return Number(e.client_id) === Number(inv.order?.client_id)
  return e.kind === 'conversation' && e.type === 'invoice' && Number(e.id) === Number(inv.id)
}, () => load(true))
</script>

<template>
  <LoadingState v-if="loading && !invoice" />
  <div v-else-if="invoice" class="space-y-5">
    <PageHeader :title="t('invoices.showTitle', { id: invoice.id })" :back-to="'/invoices'" :back-label="t('invoices.allInvoices')">
      <template #meta>
        <p class="mt-1 text-sm text-slate-500">
          <RouterLink
            v-if="auth.can('clients.view') && invoice.order?.client_id"
            :to="`/clients/${invoice.order.client_id}`"
            class="text-accent hover:underline"
          >{{ invoice.order?.client?.name }}</RouterLink>
          <span v-else>{{ invoice.order?.client?.name }}</span>
          ·
          <RouterLink :to="`/orders/${invoice.order_id}`" class="text-accent hover:underline">{{ t('invoices.order') }} #{{ invoice.order_id }}</RouterLink>
          <span v-if="invoice.creator"> · {{ t('common.createdBy') }} {{ personName(invoice.creator) }}</span>
        </p>
      </template>
      <template #actions>
        <Badge variant="secondary">{{ named('invoiceStatus', invoice.status) }}</Badge>
        <PdfExportButton @click="exportDetail" />
        <Button v-if="canReceive" variant="outline" @click="openReceive">
          <Wallet class="size-4" /> {{ t('clients.receivePayment') }}
        </Button>
        <Button v-if="canApply" variant="outline" @click="openApply">
          {{ t('clients.applyCredit') }}
        </Button>
        <ConversationActions type="invoice" :id="invoice.id" />
        <Button
          v-if="invoice.status === 'draft' && auth.canAny('invoices.update', 'invoices.confirm')"
          @click="editorOpen = true"
        >{{ auth.can('invoices.confirm') ? t('invoices.review') : t('common.edit') }}</Button>
        <DeleteButton v-if="canDelete" @click="confirmOpen = true" />
      </template>
    </PageHeader>

    <p v-if="error" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      {{ error }}
    </p>

    <section class="panel overflow-hidden">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t('common.item') }}</th>
            <th>{{ t('orders.machines') }}</th>
            <th>{{ t('common.qty') }}</th>
            <th>{{ t('invoices.price') }}</th>
            <th>{{ t('dispatch.covered') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="line in invoice.items" :key="line.id">
            <td>{{ line.item?.name || line.description }}</td>
            <td :data-label="t('orders.machines')">{{ machineLabel(line.machine, { includeSerial: true }) }}</td>
            <td :data-label="t('common.qty')" class="tabular-nums">{{ line.quantity }}</td>
            <td :data-label="t('invoices.price')" class="tabular-nums">{{ line.unit_amount }}</td>
            <td :data-label="t('dispatch.covered')">{{ line.is_covered ? t('common.yes') : t('common.no') }}</td>
          </tr>
        </tbody>
      </table>
      <dl class="grid gap-3 border-t border-slate-100 px-5 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800">
        <div>
          <dt class="text-xs text-slate-500">{{ t('invoices.total') }}</dt>
          <dd class="mt-0.5 text-lg font-semibold tabular-nums">{{ invoice.total }}</dd>
        </div>
        <div v-if="invoice.discount">
          <dt class="text-xs text-slate-500">{{ t('common.discount') }}</dt>
          <dd class="mt-0.5 tabular-nums">{{ invoice.discount }}</dd>
        </div>
        <div>
          <dt class="text-xs text-slate-500">{{ t('contracts.paid') }}</dt>
          <dd class="mt-0.5 tabular-nums">{{ paid }}</dd>
        </div>
        <div>
          <dt class="text-xs text-slate-500">{{ t('contracts.remaining') }}</dt>
          <dd class="mt-0.5" :class="remainingAmountClass(remaining)">{{ remaining }}</dd>
        </div>
      </dl>
    </section>

    <section class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
      <div class="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h2 class="text-sm font-medium">{{ t('clients.payments') }}</h2>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <Button v-if="canReceive" variant="outline" size="sm" @click="openReceive">
            <Plus class="size-3.5" /> {{ t('clients.receivePayment') }}
          </Button>
          <Button v-if="canApply" variant="outline" size="sm" @click="openApply">
            {{ t('clients.applyCredit') }}
          </Button>
        </div>
      </div>
      <EmptyState
        v-if="!allocations.length"
        :title="t('clients.noPayments')"
        :description="invoice.status === 'draft' ? t('invoices.confirmToCollect') : undefined"
      >
        <template v-if="canCollect" #action>
          <Button @click="openReceive">
            <Plus class="size-4" /> {{ t('clients.receivePayment') }}
          </Button>
        </template>
        <template v-else-if="invoice.status === 'draft' && auth.canAny('invoices.update', 'invoices.confirm')" #action>
          <Button @click="editorOpen = true">
            {{ auth.can('invoices.confirm') ? t('invoices.review') : t('common.edit') }}
          </Button>
        </template>
      </EmptyState>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>{{ t('contracts.amount') }}</th>
            <th>{{ t('tech.method') }}</th>
            <th>{{ t('contracts.collectedBy') }}</th>
            <th>{{ t('contracts.collectedAt') }}</th>
            <th>{{ t('common.notes') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in allocations" :key="row.id">
            <td class="font-medium tabular-nums" :data-label="t('contracts.amount')">{{ row.amount }}</td>
            <td :data-label="t('tech.method')">{{ paymentMethodLabel(row) }}</td>
            <td :data-label="t('contracts.collectedBy')">
              {{ personName(row.payment?.receiver || row.applier) }}
            </td>
            <td class="tabular-nums" :data-label="t('contracts.collectedAt')">{{ fmtDate(row.created_at) }}</td>
            <td :data-label="t('common.notes')">{{ row.payment?.notes || t('common.dash') }}</td>
            <td class="text-end">
              <div class="flex items-center justify-end gap-1">
                <PdfExportButton v-if="row.payment_id || row.payment" size="sm" @click="exportReceipt(row)" />
                <ConversationActions
                  v-if="row.payment_id || row.payment?.id"
                  type="payment"
                  :id="row.payment_id || row.payment?.id || 0"
                  size="sm"
                  :follow-hash="false"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="invoice.report" class="panel px-5 py-4">
      <p class="text-xs font-medium tracking-wide text-slate-500 uppercase">{{ t('invoices.report') }}</p>
      <p class="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{{ invoice.report }}</p>
    </section>
  </div>

  <InvoiceDraftDialog v-model:open="editorOpen" :invoice-id="invoice?.id" @saved="load" />

  <ReceivePaymentDialog
    v-model:open="payOpen"
    :client-id="invoice?.order?.client_id ?? null"
    :wallet="wallet"
    :dues="dues"
    :preset="payPreset"
    :mode="payMode"
    @saved="load"
  />

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
