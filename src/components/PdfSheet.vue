<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { named, personName } from '@/i18n'
import { fmtDate } from '@/lib/utils'
import { contractRef } from '@/lib/contract'
import { machineLabel } from '@/lib/machines'
import { paymentMethodLabel } from '@/lib/payments'
import { invoicePaidAmount, invoiceRemaining } from '@/lib/orderInvoices'
import { usePdfStore } from '@/stores/pdf'
import { useLocaleStore } from '@/stores/locale'
import ContractPDF from '@/components/contract-pdf/ContractPDF.vue'
import LetterheadPages from '@/components/LetterheadPages.vue'

const { t, locale } = useI18n()
const pdf = usePdfStore()
const localeStore = useLocaleStore()
const { doc } = storeToRefs(pdf)

const kind = computed(() => doc.value?.kind)
const data = computed(() => doc.value?.data || {})
const title = computed(() => doc.value?.title || '')
const isLetterheadDoc = computed(() =>
  kind.value === 'invoice-list' ||
  kind.value === 'invoice-detail' ||
  kind.value === 'payment-list' ||
  kind.value === 'payment-receipt',
)

const printedAt = computed(() => {
  void doc.value
  return new Date().toLocaleString(locale.value === 'ar' ? 'ar' : 'en-GB')
})

function money(n?: number | null) {
  return Number(n || 0).toLocaleString(locale.value === 'ar' ? 'ar' : 'en')
}

function dash(value?: string | number | null) {
  if (value === 0) return '0'
  return value ? String(value) : t('common.dash')
}

function appliedLabel(row: { allocations?: { invoice_id?: number | null; installment_id?: number | null }[] }) {
  const allocs = row.allocations || []
  if (!allocs.length) return t('clients.asCredit')
  return allocs.map((alloc: any) => {
    if (alloc.invoice_id) return t('clients.forInvoice', { id: alloc.invoice_id })
    if (alloc.installment_id) return t('clients.forInstallment')
    return t('clients.asCredit')
  }).join(' · ')
}

const invoice = computed(() => data.value.invoice || {})
const payment = computed(() => data.value.payment || {})
const client = computed(() => data.value.client || invoice.value.order?.client || {})
</script>

<template>
  <div
    v-if="doc"
    id="pdf-root"
    :class="{
      'pdf-letterhead': kind === 'contract-detail',
      'pdf-letterhead-doc': isLetterheadDoc,
    }"
    :dir="kind === 'contract-detail' || localeStore.locale === 'ar' ? 'rtl' : 'ltr'"
    :lang="kind === 'contract-detail' ? 'ar' : undefined"
    aria-hidden="true"
  >
    <ContractPDF
      v-if="kind === 'contract-detail'"
      :key="`${data.contract?.id || data.contract?.referenceable_number}-${data.template}`"
      :contract="data.contract"
      :template="Number(data.template) || 1"
      @ready="pdf.markReady()"
    />

    <LetterheadPages
      v-else-if="isLetterheadDoc"
      :dir="localeStore.locale === 'ar' ? 'rtl' : 'ltr'"
      @ready="pdf.markReady()"
    >
      <header class="pdf-letterhead-head">
        <h1>{{ title }}</h1>
        <p>{{ t('common.printedAt', { at: printedAt }) }}</p>
      </header>

      <table v-if="kind === 'invoice-list'" class="pdf-table">
        <thead>
          <tr>
            <th>{{ t('common.invoice') }}</th>
            <th>{{ t('common.client') }}</th>
            <th>{{ t('invoices.order') }}</th>
            <th>{{ t('common.technician') }}</th>
            <th>{{ t('common.status') }}</th>
            <th>{{ t('invoices.total') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data.rows || []" :key="row.id">
            <td>#{{ row.id }}</td>
            <td>{{ row.order?.client?.name || t('common.dash') }}</td>
            <td>#{{ row.order_id }}</td>
            <td>{{ personName(row.order?.technician) }}</td>
            <td>{{ named('invoiceStatus', row.status) }}</td>
            <td class="num">{{ money(row.total) }}</td>
          </tr>
        </tbody>
      </table>

      <template v-else-if="kind === 'invoice-detail'">
        <dl class="pdf-meta">
          <div>
            <dt>{{ t('common.client') }}</dt>
            <dd>{{ invoice.order?.client?.name || t('common.dash') }}</dd>
          </div>
          <div>
            <dt>{{ t('invoices.order') }}</dt>
            <dd>#{{ invoice.order_id }}</dd>
          </div>
          <div>
            <dt>{{ t('common.status') }}</dt>
            <dd>{{ named('invoiceStatus', invoice.status) }}</dd>
          </div>
          <div v-if="invoice.creator">
            <dt>{{ t('common.createdBy') }}</dt>
            <dd>{{ personName(invoice.creator) }}</dd>
          </div>
        </dl>
        <table class="pdf-table">
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
            <tr v-for="line in invoice.items || []" :key="line.id">
              <td>{{ line.item?.name || line.description }}</td>
              <td>{{ machineLabel(line.machine, { includeSerial: true }) }}</td>
              <td class="num">{{ line.quantity }}</td>
              <td class="num">{{ money(line.unit_amount) }}</td>
              <td>{{ line.is_covered ? t('common.yes') : t('common.no') }}</td>
            </tr>
          </tbody>
        </table>
        <dl class="pdf-meta">
          <div v-if="invoice.subtotal != null">
            <dt>{{ t('common.item') }}</dt>
            <dd>{{ money(invoice.subtotal) }}</dd>
          </div>
          <div v-if="invoice.discount">
            <dt>{{ t('common.discount') }}</dt>
            <dd>{{ money(invoice.discount) }}</dd>
          </div>
          <div>
            <dt>{{ t('invoices.total') }}</dt>
            <dd>{{ money(invoice.total) }}</dd>
          </div>
          <div>
            <dt>{{ t('contracts.paid') }}</dt>
            <dd>{{ money(invoicePaidAmount(invoice)) }}</dd>
          </div>
          <div>
            <dt>{{ t('contracts.remaining') }}</dt>
            <dd>{{ money(invoiceRemaining(invoice)) }}</dd>
          </div>
        </dl>
        <template v-if="invoice.allocations?.length">
          <h2 class="pdf-h">{{ t('clients.payments') }}</h2>
          <table class="pdf-table">
            <thead>
              <tr>
                <th>{{ t('contracts.amount') }}</th>
                <th>{{ t('tech.method') }}</th>
                <th>{{ t('contracts.collectedBy') }}</th>
                <th>{{ t('contracts.collectedAt') }}</th>
                <th>{{ t('common.notes') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in invoice.allocations" :key="row.id">
                <td class="num">{{ money(row.amount) }}</td>
                <td>{{ paymentMethodLabel(row) }}</td>
                <td>{{ personName(row.payment?.receiver || row.applier) }}</td>
                <td>{{ fmtDate(row.created_at) }}</td>
                <td>{{ dash(row.payment?.notes) }}</td>
              </tr>
            </tbody>
          </table>
        </template>
        <template v-if="invoice.report">
          <h2 class="pdf-h">{{ t('invoices.report') }}</h2>
          <p class="pdf-report">{{ invoice.report }}</p>
        </template>
      </template>

      <p v-else-if="kind === 'payment-list'" class="pdf-lead">{{ client.name }}</p>
      <table v-if="kind === 'payment-list'" class="pdf-table">
          <thead>
            <tr>
              <th>{{ t('contracts.amount') }}</th>
              <th>{{ t('tech.method') }}</th>
              <th>{{ t('clients.appliedTo') }}</th>
              <th>{{ t('contracts.collectedBy') }}</th>
              <th>{{ t('contracts.collectedAt') }}</th>
              <th>{{ t('common.notes') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.rows || []" :key="row.id">
              <td class="num">{{ money(row.amount) }}</td>
              <td>{{ paymentMethodLabel(row) }}</td>
              <td>{{ appliedLabel(row) }}</td>
              <td>{{ personName(row.receiver) }}</td>
              <td>{{ fmtDate(row.created_at) }}</td>
              <td>{{ dash(row.notes) }}</td>
            </tr>
          </tbody>
        </table>

      <template v-else-if="kind === 'payment-receipt'">
        <dl class="pdf-meta">
          <div>
            <dt>{{ t('common.client') }}</dt>
            <dd>{{ client.name || t('common.dash') }}</dd>
          </div>
          <div>
            <dt>{{ t('contracts.amount') }}</dt>
            <dd>{{ money(payment.amount) }}</dd>
          </div>
          <div>
            <dt>{{ t('tech.method') }}</dt>
            <dd>{{ paymentMethodLabel(payment) }}</dd>
          </div>
          <div>
            <dt>{{ t('contracts.collectedAt') }}</dt>
            <dd>{{ fmtDate(payment.created_at) }}</dd>
          </div>
          <div>
            <dt>{{ t('contracts.collectedBy') }}</dt>
            <dd>{{ personName(payment.receiver) }}</dd>
          </div>
          <div>
            <dt>{{ t('clients.appliedTo') }}</dt>
            <dd>{{ appliedLabel(payment) }}</dd>
          </div>
        </dl>
        <p v-if="payment.notes"><strong>{{ t('common.notes') }}:</strong> {{ payment.notes }}</p>
      </template>
    </LetterheadPages>

    <template v-else>
      <header class="pdf-head">
        <div>
          <p class="pdf-brand">{{ t('brand.name') }}</p>
        </div>
        <div class="pdf-head-meta">
          <h1>{{ title }}</h1>
          <p>{{ t('common.printedAt', { at: printedAt }) }}</p>
        </div>
      </header>

      <section v-if="kind === 'contract-list'">
        <table class="pdf-table">
          <thead>
            <tr>
              <th>#</th>
              <th>{{ t('common.client') }}</th>
              <th>{{ t('common.location') }}</th>
              <th>{{ t('common.type') }}</th>
              <th>{{ t('common.status') }}</th>
              <th>{{ t('contracts.period') }}</th>
              <th>{{ t('contracts.value') }}</th>
              <th>{{ t('clients.netDue') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.rows || []" :key="row.id">
              <td>{{ contractRef(row) }}</td>
              <td>{{ row.client?.name || t('common.dash') }}</td>
              <td>{{ row.location?.label || t('common.dash') }}</td>
              <td>{{ named('contractType', row.type) }}</td>
              <td>{{ named('contractStatus', row.status) }}</td>
              <td>{{ fmtDate(row.start_date) }} – {{ fmtDate(row.end_date) }}</td>
              <td class="num">{{ money(row.total_amount) }}</td>
              <td class="num">{{ money(row.net_due) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-else-if="kind === 'collections-list'">
      <dl class="pdf-meta">
        <div>
          <dt>{{ named('tech', 'cash') }}</dt>
          <dd>{{ money(data.by_method?.cash) }}</dd>
        </div>
        <div>
          <dt>{{ named('tech', 'card') }}</dt>
          <dd>{{ money(data.by_method?.card) }}</dd>
        </div>
        <div>
          <dt>{{ named('tech', 'bank') }}</dt>
          <dd>{{ money(data.by_method?.bank) }}</dd>
        </div>
        <div>
          <dt>{{ t('accounting.collected') }}</dt>
          <dd>{{ money(data.total) }}</dd>
        </div>
      </dl>
      <table class="pdf-table">
        <thead>
          <tr>
            <th>{{ t('accounting.date') }}</th>
            <th>{{ t('common.client') }}</th>
            <th>{{ t('accounting.source') }}</th>
            <th>{{ t('inventory.receivedBy') }}</th>
            <th>{{ t('accounting.collected') }}</th>
            <th>{{ t('common.notes') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data.rows || []" :key="row.id">
            <td>{{ row.date }}</td>
            <td>{{ row.client }}</td>
            <td>{{ named('tech', row.method, row.method) }}</td>
            <td>{{ personName(row.received_by) }}</td>
            <td class="num">{{ money(row.amount) }}</td>
            <td>{{ dash(row.notes) }}</td>
          </tr>
          <tr v-if="!(data.rows || []).length">
            <td colspan="6">{{ t('accounting.emptyReport') }}</td>
          </tr>
        </tbody>
      </table>
    </section>
    </template>
  </div>
</template>
