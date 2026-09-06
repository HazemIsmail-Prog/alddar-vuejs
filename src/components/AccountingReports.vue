<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import { apiError } from '@/lib/utils'
import { named, personName } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Field from '@/components/ui/Field.vue'
import ClientPicker from '@/components/ClientPicker.vue'
import PdfExportButton from '@/components/PdfExportButton.vue'
import { usePdfStore } from '@/stores/pdf'

defineProps<{ accounts: any[] }>()

type ReportId = 'pnl' | 'balance' | 'ledger' | 'ar' | 'collections' | 'statement' | 'installments'

const { t } = useI18n()
const pdf = usePdfStore()
const report = ref<ReportId>('pnl')
const from = ref(monthStart())
const to = ref(today())
const asOf = ref(today())
const accountId = ref('')
const clientId = ref<number | ''>('')
const method = ref('')
const status = ref('')
const overdueOnly = ref(false)
const data = ref<any>(null)
const error = ref('')
const loading = ref(false)

const reportList = [
  { id: 'pnl', labelKey: 'accounting.reportPnl', hintKey: 'accounting.hintPnl' },
  { id: 'balance', labelKey: 'accounting.reportBalance', hintKey: 'accounting.hintBalance' },
  { id: 'ledger', labelKey: 'accounting.reportLedger', hintKey: 'accounting.hintLedger' },
  { id: 'ar', labelKey: 'accounting.reportAr', hintKey: 'accounting.hintAr' },
  { id: 'collections', labelKey: 'accounting.reportCollections', hintKey: 'accounting.hintCollections' },
  { id: 'statement', labelKey: 'accounting.reportStatement', hintKey: 'accounting.hintStatement' },
  { id: 'installments', labelKey: 'accounting.reportInstallments', hintKey: 'accounting.hintInstallments' },
] as const

const currentHint = computed(() => reportList.find((item) => item.id === report.value)?.hintKey || '')
const needsRange = computed(() => ['pnl', 'ledger', 'collections', 'statement'].includes(report.value))
const needsAsOf = computed(() => ['balance', 'ar', 'installments'].includes(report.value))
const needsClient = computed(() => ['ar', 'collections', 'statement', 'installments'].includes(report.value))

function monthStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function money(n?: number | null) {
  return Number(n || 0).toLocaleString()
}

function params() {
  const q: Record<string, string | number | boolean> = {}
  if (needsRange.value) {
    if (from.value) q.from = from.value
    if (to.value) q.to = to.value
  }
  if (needsAsOf.value && asOf.value) q.as_of = asOf.value
  if (needsClient.value && clientId.value) q.client_id = clientId.value
  if (report.value === 'ledger' && accountId.value) q.account_id = accountId.value
  if (report.value === 'collections' && method.value) q.method = method.value
  if (report.value === 'installments') {
    if (status.value) q.status = status.value
    if (overdueOnly.value) q.overdue = true
  }
  return q
}

async function run() {
  if (loading.value) return
  error.value = ''
  if (report.value === 'statement' && !clientId.value) {
    data.value = null
    return
  }
  if (report.value === 'ledger' && !accountId.value) {
    data.value = null
    return
  }
  loading.value = true
  try {
    if (report.value === 'ledger') {
      const { data: body } = await api.get(`/api/accounts/${accountId.value}/ledger`, {
        params: { from: from.value || undefined, to: to.value || undefined },
      })
      data.value = body
    } else {
      const path = {
        pnl: '/api/reports/income-statement',
        balance: '/api/reports/balance-sheet',
        ar: '/api/reports/ar-aging',
        collections: '/api/reports/collections',
        statement: '/api/reports/client-statement',
        installments: '/api/reports/installments',
      }[report.value]
      const { data: body } = await api.get(path, { params: params() })
      data.value = body
    }
  } catch (e) {
    data.value = null
    error.value = apiError(e)
  } finally {
    loading.value = false
  }
}

watch(report, () => { void run() })
onMounted(() => { void run() })

async function exportCollections() {
  if (report.value !== 'collections' || !data.value) return
  await pdf.print({
    kind: 'collections-list',
    title: t('pdf.collections'),
    filename: 'collections',
    data: data.value,
  })
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap gap-2">
      <button
        v-for="item in reportList"
        :key="item.id"
        type="button"
        class="rounded-full px-3 py-1.5 text-sm"
        :class="report === item.id ? 'bg-sidebar text-white' : 'border border-slate-200 bg-white text-slate-600'"
        @click="report = item.id"
      >
        {{ t(item.labelKey) }}
      </button>
    </div>
    <p class="text-sm text-slate-500">{{ t(currentHint) }}</p>

    <div class="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700">
      <Field v-if="needsRange" :label="t('accounting.from')">
        <Input v-model="from" type="date" />
      </Field>
      <Field v-if="needsRange" :label="t('accounting.to')">
        <Input v-model="to" type="date" />
      </Field>
      <Field v-if="needsAsOf" :label="t('accounting.asOf')">
        <Input v-model="asOf" type="date" />
      </Field>
      <Field v-if="report === 'ledger'" :label="t('accounting.account')">
        <select v-model="accountId" class="select min-w-56">
          <option value="">{{ t('accounting.pickAccount') }}</option>
          <option v-for="a in accounts" :key="a.id" :value="String(a.id)">{{ a.code }} {{ a.name }}</option>
        </select>
      </Field>
      <Field v-if="needsClient" :label="t('common.client')" class="min-w-56">
        <ClientPicker v-model="clientId" :allow-create="false" :placeholder="t('accounting.pickClient')" />
      </Field>
      <Field v-if="report === 'collections'" :label="t('accounting.source')">
        <select v-model="method" class="select">
          <option value="">{{ t('accounting.allMethods') }}</option>
          <option value="cash">{{ named('tech', 'cash') }}</option>
          <option value="card">{{ named('tech', 'card') }}</option>
          <option value="bank">{{ named('tech', 'bank') }}</option>
        </select>
      </Field>
      <Field v-if="report === 'installments'" :label="t('common.status')">
        <select v-model="status" class="select">
          <option value="">{{ t('accounting.allStatuses') }}</option>
          <option value="pending">{{ named('installmentStatus', 'pending') }}</option>
          <option value="billed">{{ named('installmentStatus', 'billed') }}</option>
          <option value="paid">{{ named('installmentStatus', 'paid') }}</option>
        </select>
      </Field>
      <label v-if="report === 'installments'" class="flex items-center gap-2 pb-2 text-sm text-slate-600">
        <input v-model="overdueOnly" type="checkbox" class="size-4" />
        {{ t('accounting.overdueOnly') }}
      </label>
      <Button :loading="loading" @click="run">
        {{ t('accounting.run') }}
      </Button>
      <PdfExportButton
        v-if="report === 'collections'"
        :disabled="!data || loading"
        @click="exportCollections"
      />
    </div>

    <p v-if="error" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error }}</p>
    <p v-else-if="report === 'statement' && !clientId" class="text-sm text-slate-500">{{ t('accounting.statementNeedClient') }}</p>
    <p v-else-if="report === 'ledger' && !accountId" class="text-sm text-slate-500">{{ t('accounting.pickAccount') }}</p>
    <p v-else-if="loading" class="text-sm text-slate-500">{{ t('common.searching') }}</p>

    <div v-else-if="report === 'pnl' && data" class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
      <table class="data-table">
        <thead><tr><th>{{ t('accounting.code') }}</th><th>{{ t('accounting.name') }}</th><th class="text-end">{{ t('accounting.balance') }}</th></tr></thead>
        <tbody>
          <tr class="bg-slate-50 font-medium"><td colspan="3">{{ t('accounting.income') }}</td></tr>
          <tr v-for="row in data.income" :key="row.code"><td>{{ row.code }}</td><td>{{ row.name }}</td><td class="text-end">{{ money(row.amount) }}</td></tr>
          <tr class="font-medium"><td colspan="2">{{ t('accounting.totals') }}</td><td class="text-end">{{ money(data.income_total) }}</td></tr>
          <tr class="bg-slate-50 font-medium"><td colspan="3">{{ t('accounting.expenses') }}</td></tr>
          <tr v-for="row in data.expenses" :key="row.code"><td>{{ row.code }}</td><td>{{ row.name }}</td><td class="text-end">{{ money(row.amount) }}</td></tr>
          <tr class="font-medium"><td colspan="2">{{ t('accounting.totals') }}</td><td class="text-end">{{ money(data.expense_total) }}</td></tr>
          <tr class="bg-slate-100 text-base font-semibold">
            <td colspan="2">{{ data.net_income >= 0 ? t('accounting.netProfit') : t('accounting.netLoss') }}</td>
            <td class="text-end">{{ money(data.net_income) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="report === 'balance' && data" class="grid gap-4 lg:grid-cols-2">
      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
        <table class="data-table">
          <thead><tr><th colspan="2">{{ t('accounting.assets') }}</th></tr></thead>
          <tbody>
            <tr v-for="row in data.assets" :key="row.code"><td>{{ row.code }} {{ row.name }}</td><td class="text-end">{{ money(row.amount) }}</td></tr>
            <tr class="font-semibold"><td>{{ t('accounting.totals') }}</td><td class="text-end">{{ money(data.asset_total) }}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
        <table class="data-table">
          <thead><tr><th colspan="2">{{ t('accounting.liabilities') }}</th></tr></thead>
          <tbody>
            <tr v-for="row in data.liabilities" :key="row.code"><td>{{ row.code }} {{ row.name }}</td><td class="text-end">{{ money(row.amount) }}</td></tr>
            <tr class="font-medium"><td>{{ t('accounting.totals') }}</td><td class="text-end">{{ money(data.liability_total) }}</td></tr>
            <tr class="bg-slate-50 font-medium"><td colspan="2">{{ t('accounting.equity') }}</td></tr>
            <tr v-for="row in data.equity" :key="row.code"><td>{{ row.code }} {{ row.name }}</td><td class="text-end">{{ money(row.amount) }}</td></tr>
            <tr><td>{{ t('accounting.netIncome') }}</td><td class="text-end">{{ money(data.net_income) }}</td></tr>
            <tr class="font-medium"><td>{{ t('accounting.totals') }}</td><td class="text-end">{{ money(data.equity_total) }}</td></tr>
            <tr class="bg-slate-100 font-semibold"><td>{{ t('accounting.liabilitiesAndEquity') }}</td><td class="text-end">{{ money(data.liabilities_and_equity) }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else-if="report === 'ledger' && data" class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t('accounting.date') }}</th>
            <th>{{ t('accounting.description') }}</th>
            <th>{{ t('accounting.source') }}</th>
            <th class="text-end">{{ t('accounting.debit') }}</th>
            <th class="text-end">{{ t('accounting.credit') }}</th>
            <th class="text-end">{{ t('accounting.balance') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr class="bg-slate-50">
            <td colspan="5">{{ t('accounting.opening') }}</td>
            <td class="text-end">{{ money(data.opening) }}</td>
          </tr>
          <tr v-for="line in data.lines" :key="line.id">
            <td class="whitespace-nowrap">{{ line.date }}</td>
            <td>{{ line.description }}</td>
            <td>{{ named('journalSource', line.source_type) }}</td>
            <td class="text-end">{{ line.debit ? money(line.debit) : '' }}</td>
            <td class="text-end">{{ line.credit ? money(line.credit) : '' }}</td>
            <td class="text-end">{{ money(line.balance) }}</td>
          </tr>
          <tr v-if="!data.lines?.length"><td colspan="6" class="text-slate-400">{{ t('accounting.emptyReport') }}</td></tr>
          <tr class="bg-slate-100 font-semibold">
            <td colspan="5">{{ t('accounting.closing') }}</td>
            <td class="text-end">{{ money(data.closing) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="report === 'ar' && data" class="space-y-3">
      <div class="grid gap-3 sm:grid-cols-5">
        <div class="rounded-lg bg-slate-50 p-3 text-sm"><p class="text-slate-500">{{ t('accounting.bucketCurrent') }}</p><p class="font-semibold">{{ money(data.buckets?.current) }}</p></div>
        <div class="rounded-lg bg-slate-50 p-3 text-sm"><p class="text-slate-500">{{ t('accounting.bucket60') }}</p><p class="font-semibold">{{ money(data.buckets?.days_31_60) }}</p></div>
        <div class="rounded-lg bg-slate-50 p-3 text-sm"><p class="text-slate-500">{{ t('accounting.bucket90') }}</p><p class="font-semibold">{{ money(data.buckets?.days_61_90) }}</p></div>
        <div class="rounded-lg bg-slate-50 p-3 text-sm"><p class="text-slate-500">{{ t('accounting.bucket90plus') }}</p><p class="font-semibold">{{ money(data.buckets?.days_90) }}</p></div>
        <div class="rounded-lg bg-slate-100 p-3 text-sm"><p class="text-slate-500">{{ t('accounting.totals') }}</p><p class="font-semibold">{{ money(data.total) }}</p></div>
      </div>
      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t('common.client') }}</th>
              <th>{{ t('accounting.description') }}</th>
              <th>{{ t('accounting.date') }}</th>
              <th class="text-end">{{ t('accounting.days') }}</th>
              <th class="text-end">{{ t('accounting.original') }}</th>
              <th class="text-end">{{ t('accounting.remaining') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.rows" :key="row.kind + row.id">
              <td>{{ row.client }}</td>
              <td>{{ row.description }}</td>
              <td class="whitespace-nowrap">{{ row.date }}</td>
              <td class="text-end">{{ row.days }}</td>
              <td class="text-end">{{ money(row.original) }}</td>
              <td class="text-end">{{ money(row.remaining) }}</td>
            </tr>
            <tr v-if="!data.rows?.length"><td colspan="6" class="text-slate-400">{{ t('accounting.emptyReport') }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else-if="report === 'collections' && data" class="space-y-3">
      <div class="grid gap-3 sm:grid-cols-4">
        <div class="rounded-lg bg-slate-50 p-3 text-sm"><p class="text-slate-500">{{ named('tech', 'cash') }}</p><p class="font-semibold">{{ money(data.by_method?.cash) }}</p></div>
        <div class="rounded-lg bg-slate-50 p-3 text-sm"><p class="text-slate-500">{{ named('tech', 'card') }}</p><p class="font-semibold">{{ money(data.by_method?.card) }}</p></div>
        <div class="rounded-lg bg-slate-50 p-3 text-sm"><p class="text-slate-500">{{ named('tech', 'bank') }}</p><p class="font-semibold">{{ money(data.by_method?.bank) }}</p></div>
        <div class="rounded-lg bg-slate-100 p-3 text-sm"><p class="text-slate-500">{{ t('accounting.collected') }}</p><p class="font-semibold">{{ money(data.total) }}</p></div>
      </div>
      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t('accounting.date') }}</th>
              <th>{{ t('common.client') }}</th>
              <th>{{ t('accounting.source') }}</th>
              <th>{{ t('inventory.receivedBy') }}</th>
              <th class="text-end">{{ t('accounting.collected') }}</th>
              <th>{{ t('common.notes') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.rows" :key="row.id">
              <td class="whitespace-nowrap">{{ row.date }}</td>
              <td>{{ row.client }}</td>
              <td>{{ named('tech', row.method, row.method) }}</td>
              <td>{{ personName(row.received_by) }}</td>
              <td class="text-end">{{ money(row.amount) }}</td>
              <td>{{ row.notes || t('common.dash') }}</td>
            </tr>
            <tr v-if="!data.rows?.length"><td colspan="6" class="text-slate-400">{{ t('accounting.emptyReport') }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else-if="report === 'statement' && data" class="space-y-3">
      <div class="grid gap-3 sm:grid-cols-5">
        <div class="rounded-lg bg-slate-50 p-3 text-sm"><p class="text-slate-500">{{ t('accounting.opening') }}</p><p class="font-semibold">{{ money(data.opening) }}</p></div>
        <div class="rounded-lg bg-slate-50 p-3 text-sm"><p class="text-slate-500">{{ t('accounting.charged') }}</p><p class="font-semibold">{{ money(data.charged) }}</p></div>
        <div class="rounded-lg bg-slate-50 p-3 text-sm"><p class="text-slate-500">{{ t('accounting.paid') }}</p><p class="font-semibold">{{ money(data.paid) }}</p></div>
        <div class="rounded-lg bg-slate-50 p-3 text-sm"><p class="text-slate-500">{{ t('clients.wallet') }}</p><p class="font-semibold">{{ money(data.wallet) }}</p></div>
        <div class="rounded-lg bg-slate-100 p-3 text-sm"><p class="text-slate-500">{{ t('accounting.owed') }}</p><p class="font-semibold">{{ money(data.net_due) }}</p></div>
      </div>
      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t('accounting.date') }}</th>
              <th>{{ t('common.type') }}</th>
              <th>{{ t('accounting.description') }}</th>
              <th class="text-end">{{ t('accounting.charged') }}</th>
              <th class="text-end">{{ t('accounting.paid') }}</th>
              <th class="text-end">{{ t('accounting.balance') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(line, i) in data.lines" :key="i">
              <td class="whitespace-nowrap">{{ line.date }}</td>
              <td>{{ named('statementKind', line.kind) }}</td>
              <td>{{ line.description }}</td>
              <td class="text-end">{{ line.charged ? money(line.charged) : '' }}</td>
              <td class="text-end">{{ line.paid ? money(line.paid) : '' }}</td>
              <td class="text-end">{{ money(line.balance) }}</td>
            </tr>
            <tr v-if="!data.lines?.length"><td colspan="6" class="text-slate-400">{{ t('accounting.emptyReport') }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else-if="report === 'installments' && data" class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t('common.client') }}</th>
            <th>{{ t('accounting.description') }}</th>
            <th>{{ t('accounting.date') }}</th>
            <th>{{ t('common.status') }}</th>
            <th class="text-end">{{ t('accounting.original') }}</th>
            <th class="text-end">{{ t('accounting.remaining') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data.rows" :key="row.id">
            <td>{{ row.client }}</td>
            <td>{{ row.description || t('common.dash') }}</td>
            <td class="whitespace-nowrap">{{ row.due_date }}</td>
            <td>{{ named('installmentStatus', row.status) }}</td>
            <td class="text-end">{{ money(row.amount) }}</td>
            <td class="text-end">{{ money(row.remaining) }}</td>
          </tr>
          <tr v-if="!data.rows?.length"><td colspan="6" class="text-slate-400">{{ t('accounting.emptyReport') }}</td></tr>
          <tr v-else class="bg-slate-100 font-semibold">
            <td colspan="5">{{ t('accounting.totals') }}</td>
            <td class="text-end">{{ money(data.total_remaining) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
