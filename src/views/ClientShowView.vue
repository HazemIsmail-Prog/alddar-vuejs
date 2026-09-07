<script setup lang="ts">
import { computed, watch, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { MapPin, Pencil, Plus, Wallet } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import { apiError, fmtDate, remainingAmountClass } from '@/lib/utils'
import { named, personName, departmentName } from '@/i18n'
import { formatPhone } from '@/lib/phone'
import { machineLabel } from '@/lib/machines'
import { dueTone, paymentMethodLabel } from '@/lib/payments'
import { orderInvoices } from '@/lib/orderInvoices'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import StatusBadge from '@/components/StatusBadge.vue'
import ReceivePaymentDialog, { type PaymentDue } from '@/components/ReceivePaymentDialog.vue'
import ConversationActions from '@/components/ConversationActions.vue'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import PdfExportButton from '@/components/PdfExportButton.vue'
import PhoneActions from '@/components/PhoneActions.vue'
import { useAuthStore } from '@/stores/auth'
import { useModalsStore } from '@/stores/modals'
import { usePdfStore } from '@/stores/pdf'
import { useStaffReload } from '@/composables/useStaffEvent'
import { useReceivePayment } from '@/composables/useReceivePayment'
import LoadingState from '@/components/LoadingState.vue'

const { t } = useI18n()
const auth = useAuthStore()
const modals = useModalsStore()
const pdf = usePdfStore()
const route = useRoute()
const router = useRouter()
const client = ref<any>(null)
const error = ref('')
const loading = ref(true)
const { payOpen, payMode, payPreset, openReceive, openApply, startCollect } = useReceivePayment()

async function load(quiet = false) {
  if (!quiet) {
    loading.value = true
    error.value = ''
    client.value = null
  }
  try {
    client.value = (await api.get(`/api/clients/${route.params.id}/summary`)).data
  } catch (e) {
    if (!quiet) error.value = apiError(e)
  } finally {
    if (!quiet) loading.value = false
  }
}

function startOrder() {
  if (!client.value) return
  modals.createOrder({
    id: client.value.id,
    name: client.value.name,
    phones: client.value.phones,
    locations: client.value.locations,
  })
}

function startContract() {
  if (!client.value) return
  modals.createContract({
    id: client.value.id,
    name: client.value.name,
    phones: client.value.phones,
    locations: client.value.locations,
  })
}

const today = computed(() => {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
})
const phones = computed(() => [...(client.value?.phones || [])].sort((a: any, b: any) => Number(b.is_primary) - Number(a.is_primary)))
const totals = computed(() => client.value?.totals || {})
const wallet = computed(() => Number(totals.value.wallet || 0))
const netDue = computed(() => Number(totals.value.net_due || 0))
const outstanding = computed(() => Number(totals.value.outstanding || 0))

const dues = computed<PaymentDue[]>(() => {
  if (!client.value) return []
  const invoices = (client.value.invoices || [])
    .filter((row: any) => Number(row.remaining || 0) > 0)
    .map((row: any) => ({
      type: 'invoice' as const,
      id: row.id,
      remaining: Number(row.remaining),
      label: t('clients.forInvoice', { id: row.id }),
    }))
  const installments = (client.value.installments || [])
    .filter((row: any) => Number(row.remaining || 0) > 0)
    .map((row: any) => ({
      type: 'installment' as const,
      id: row.id,
      remaining: Number(row.remaining),
      label: `${t('clients.forInstallment')} #${row.contract_id}`,
    }))
  return [...invoices, ...installments]
})

function canCollect(row: { remaining?: number }) {
  return auth.can('payments.collect') && Number(row.remaining || 0) > 0
}

async function exportPayments() {
  if (!client.value?.payments?.length) return
  await pdf.print({
    kind: 'payment-list',
    title: t('pdf.payments'),
    filename: `payments-client-${client.value.id}`,
    data: { client: client.value, rows: client.value.payments },
  })
}

async function exportReceipt(row: any) {
  if (!client.value) return
  const id = row.payment_id || row.id
  await pdf.print({
    kind: 'payment-receipt',
    title: t('pdf.receipt', { id }),
    filename: `payment-${id}`,
    data: { client: client.value, payment: row },
  })
}

function contractRemaining(id: number) {
  return (client.value?.installments || [])
    .filter((row: any) => Number(row.contract_id) === id)
    .reduce((n: number, row: any) => n + Number(row.remaining || 0), 0)
}

watch(() => route.params.id, () => { void load() }, { immediate: true })
watch(() => modals.savedAt, () => {
  if (modals.savedKind === 'client-deleted' && modals.savedId === Number(route.params.id)) {
    void router.push('/clients')
    return
  }
  if (modals.savedKind === 'client' || modals.savedKind === 'order' || modals.savedKind === 'contract') {
    void load(true)
  }
})

useStaffReload((e) => {
  const id = Number(route.params.id)
  if (e.kind === 'client') return Number(e.client_id) === id
  if (e.kind === 'order') return Number(e.client_id) === id
  if (e.kind !== 'conversation') return false
  if (e.type === 'client' && Number(e.id) === id) return true
  if (e.type === 'order') return (client.value?.orders || []).some((row: any) => Number(row.id) === Number(e.id))
  if (e.type === 'invoice') return (client.value?.invoices || []).some((row: any) => Number(row.id) === Number(e.id))
  if (e.type === 'payment') return (client.value?.payments || []).some((row: any) => Number(row.id) === Number(e.id))
  return false
}, () => load(true))
</script>


<template>
  <LoadingState v-if="loading" :label="t('clients.loading')" />
  <div v-else-if="error" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
    {{ error }}
    <RouterLink to="/clients" class="ms-2 text-accent hover:underline">{{ t('clients.allClients') }}</RouterLink>
  </div>
  <div v-else-if="client" class="space-y-6">
    <PageHeader :title="client.name" :back-to="'/clients'" :back-label="t('clients.allClients')">
      <template #meta>
        <p class="mt-1 text-sm text-slate-500">
          {{ t('clients.sitesCount', { sites: totals.locations || 0, machines: totals.machines || 0 }) }}
          <span v-if="phones.length"> · {{ phones.length }} {{ t('clients.phones') }}</span>
        </p>
      </template>
      <template #actions>
        <Button v-if="auth.can('orders.create')" variant="outline" @click="startOrder">
          <Plus class="size-4" /> {{ t('clients.newOrder') }}
        </Button>
        <Button v-if="auth.can('contracts.create')" variant="outline" @click="startContract">
          <Plus class="size-4" /> {{ t('clients.newContract') }}
        </Button>
        <Button v-if="auth.can('payments.collect')" variant="outline" @click="openReceive({ type: 'credit' })">
          <Wallet class="size-4" /> {{ t('clients.receivePayment') }}
        </Button>
        <Button v-if="auth.can('payments.collect') && wallet > 0 && dues.length" variant="outline" @click="openApply()">
          {{ t('clients.applyCredit') }}
        </Button>
        <ConversationActions type="client" :id="client.id" />
        <Button v-if="auth.can('clients.update')" @click="modals.editClient(client.id)">
          <Pencil class="size-4" /> {{ t('clients.editDetails') }}
        </Button>
      </template>
    </PageHeader>

    <div class="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(17rem,1fr)]">
      <article class="panel p-5">
        <h2 class="text-sm font-medium">{{ t('clients.profile') }}</h2>
        <dl class="meta-grid mt-4">
          <div>
            <dt>{{ t('clients.phones') }}</dt>
            <dd>
              <p v-if="!phones.length" class="text-slate-400">{{ t('clients.noPhone') }}</p>
              <ul v-else class="space-y-2">
                <li v-for="phone in phones" :key="phone.id" class="flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <p class="tabular-nums">{{ formatPhone(phone) }}</p>
                    <Badge v-if="phone.is_primary" variant="secondary" class="mt-1">{{ t('clients.primary') }}</Badge>
                  </div>
                    <PhoneActions :phone="phone" />
                </li>
              </ul>
            </dd>
          </div>
          <div>
            <dt>{{ t('common.createdBy') }}</dt>
            <dd>{{ personName(client.creator) }}</dd>
          </div>
          <div>
            <dt>{{ t('clients.createdOn') }}</dt>
            <dd class="tabular-nums">{{ fmtDate(client.created_at) }}</dd>
          </div>
        </dl>
        <p
          v-if="client.notes"
          class="mt-4 rounded-lg border-s-[3px] border-accent bg-slate-50 px-3 py-2 text-sm leading-relaxed dark:bg-slate-800/50"
        >
          {{ client.notes }}
        </p>
      </article>

      <article class="panel p-5" :class="netDue > 0 && 'border-amber-300 dark:border-amber-800'">
        <h2 class="text-sm font-medium">{{ t('clients.balances') }}</h2>
        <p class="mt-3 text-[0.7rem] font-medium tracking-wider text-slate-500 uppercase">{{ t('clients.netDue') }}</p>
        <p class="mt-0.5 text-3xl font-semibold tabular-nums" :class="netDue > 0 ? 'text-amber-800 dark:text-amber-200' : ''">
          {{ netDue > 0 ? netDue : t('clients.settled') }}
        </p>
        <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt class="text-xs text-slate-500">{{ t('clients.outstanding') }}</dt>
            <dd class="mt-0.5 tabular-nums" :class="outstanding > 0 && 'font-medium'">{{ outstanding }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">{{ t('clients.wallet') }}</dt>
            <dd class="mt-0.5 tabular-nums">{{ totals.wallet || 0 }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">{{ t('clients.invoiced') }}</dt>
            <dd class="mt-0.5 tabular-nums">{{ totals.invoiced || 0 }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">{{ t('clients.collected') }}</dt>
            <dd class="mt-0.5 tabular-nums">{{ totals.collected || 0 }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">{{ t('clients.contractValue') }}</dt>
            <dd class="mt-0.5 tabular-nums">{{ totals.contract_value || 0 }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">{{ t('clients.activeContracts') }}</dt>
            <dd class="mt-0.5">{{ totals.active_contracts || 0 }} <span class="text-slate-400">{{ t('clients.ofTotal', { n: totals.contracts || 0 }) }}</span></dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">{{ t('clients.openOrders') }}</dt>
            <dd class="mt-0.5">{{ totals.open_orders || 0 }} <span class="text-slate-400">{{ t('clients.ofTotal', { n: totals.orders || 0 }) }}</span></dd>
          </div>
        </dl>
      </article>
    </div>

    <section class="panel">
      <div class="flex items-center justify-between gap-2 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
        <div>
          <h2 class="text-sm font-medium">{{ t('clients.locations') }}</h2>
          <p class="text-xs text-slate-500">{{ t('clients.sitesCount', { sites: totals.locations || 0, machines: totals.machines || 0 }) }}</p>
        </div>
        <Button v-if="auth.can('clients.update')" variant="outline" size="sm" @click="modals.editClient(client.id)">
          <Pencil class="size-3.5" /> {{ t('common.edit') }}
        </Button>
      </div>
      <EmptyState v-if="!client.locations?.length" :title="t('clients.noLocations')" :description="t('clients.addSitesHint')">
        <template v-if="auth.can('clients.update')" #action>
          <Button variant="outline" @click="modals.editClient(client.id)">{{ t('clients.addLocation') }}</Button>
        </template>
      </EmptyState>
      <div v-else class="grid gap-3 p-4 lg:grid-cols-2">
        <article v-for="loc in client.locations" :key="loc.id" class="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium">{{ loc.label || t('common.location') }}</p>
              <p class="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {{ loc.address || t('clients.noAddress') }}
              </p>
              <p v-if="loc.paci_number" class="mt-1 text-xs tabular-nums text-slate-500">
                {{ t('address.paci') }} {{ loc.paci_number }}
              </p>
            </div>
            <a
              v-if="loc.google_maps_link"
              :href="loc.google_maps_link"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              <MapPin class="size-3.5" />
              {{ t('tech.openMaps') }}
            </a>
          </div>
          <table v-if="loc.machines?.length" class="mt-3 w-full text-sm">
            <thead>
              <tr class="text-left text-[0.7rem] tracking-wider text-slate-500 uppercase">
                <th class="pb-1 font-medium">{{ t('clients.machine') }}</th>
                <th class="pb-1 font-medium">{{ t('clients.serial') }}</th>
                <th class="pb-1 font-medium">{{ t('common.notes') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in loc.machines" :key="m.id" class="border-t border-slate-100 dark:border-slate-800">
                <td class="py-1.5">{{ machineLabel(m) }}</td>
                <td class="py-1.5 tabular-nums text-slate-600 dark:text-slate-300">{{ m.serial || t('common.dash') }}</td>
                <td class="py-1.5 text-slate-500">{{ m.notes || t('common.dash') }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="mt-3 text-xs text-slate-400">{{ t('clients.noMachines') }}</p>
        </article>
      </div>
    </section>

    <section class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
      <div class="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h2 class="text-sm font-medium">{{ t('nav.contracts') }} <span class="font-normal text-slate-400">{{ totals.contracts || 0 }}</span></h2>
        <Button v-if="auth.can('contracts.create')" variant="outline" size="sm" @click="startContract">
          <Plus class="size-3.5" /> {{ t('clients.newContract') }}
        </Button>
      </div>
      <EmptyState v-if="!client.contracts?.length" :title="t('clients.noContracts')" :description="t('contracts.emptyHint')" />
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>{{ t('orders.id') }}</th>
            <th>{{ t('common.type') }}</th>
            <th>{{ t('common.location') }}</th>
            <th>{{ t('common.department') }}</th>
            <th>{{ t('contracts.period') }}</th>
            <th>{{ t('contracts.value') }}</th>
            <th>{{ t('clients.remaining') }}</th>
            <th>{{ t('common.status') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in client.contracts" :key="row.id">
            <td class="font-medium" :data-label="t('orders.id')">#{{ row.id }}</td>
            <td :data-label="t('common.type')">{{ named('contractType', row.type) }}</td>
            <td :data-label="t('common.location')">{{ row.location?.label || t('common.dash') }}</td>
            <td :data-label="t('common.department')">{{ departmentName(row.department) }}</td>
            <td class="tabular-nums" :data-label="t('contracts.period')">{{ fmtDate(row.start_date) }} – {{ fmtDate(row.end_date) }}</td>
            <td class="tabular-nums" :data-label="t('contracts.value')">{{ row.total_amount }}</td>
            <td :data-label="t('clients.remaining')" :class="remainingAmountClass(contractRemaining(row.id))">{{ contractRemaining(row.id) }}</td>
            <td :data-label="t('common.status')"><Badge variant="secondary">{{ named('contractStatus', row.status) }}</Badge></td>
            <td class="text-end">
              <RouterLink v-if="auth.can('contracts.view')" :to="`/contracts/${row.id}`" class="text-accent hover:underline">{{ t('common.open') }}</RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
      <div class="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h2 class="text-sm font-medium">{{ t('nav.orders') }} <span class="font-normal text-slate-400">{{ totals.orders || 0 }}</span></h2>
        <Button v-if="auth.can('orders.create')" variant="outline" size="sm" @click="startOrder">
          <Plus class="size-3.5" /> {{ t('clients.newOrder') }}
        </Button>
      </div>
      <EmptyState v-if="!client.orders?.length" :title="t('clients.noOrders')" :description="t('orders.emptyHint')" />
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>{{ t('orders.id') }}</th>
            <th>{{ t('common.location') }}</th>
            <th>{{ t('common.department') }}</th>
            <th>{{ t('contracts.plannedDate') }}</th>
            <th>{{ t('common.status') }}</th>
            <th>{{ t('common.technician') }}</th>
            <th>{{ t('nav.invoices') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in client.orders" :key="row.id">
            <td class="font-medium" :data-label="t('orders.id')">#{{ row.id }}</td>
            <td :data-label="t('common.location')">{{ row.location?.label || t('common.dash') }}</td>
            <td :data-label="t('common.department')">{{ departmentName(row.department) }}</td>
            <td class="tabular-nums" :data-label="t('contracts.plannedDate')">{{ fmtDate(row.planned_date) }}</td>
            <td :data-label="t('common.status')"><StatusBadge :status="row.status" /></td>
            <td :data-label="t('common.technician')">{{ personName(row.technician) }}</td>
            <td :data-label="t('nav.invoices')">
              <template v-if="orderInvoices(row).length && auth.can('invoices.view')">
                <RouterLink
                  v-for="inv in orderInvoices(row)"
                  :key="inv.id"
                  :to="`/invoices/${inv.id}`"
                  class="me-2 text-accent hover:underline"
                >#{{ inv.id }}</RouterLink>
              </template>
              <span v-else-if="orderInvoices(row).length">{{ orderInvoices(row).map((inv: any) => `#${inv.id}`).join(' · ') }}</span>
              <span v-else class="text-slate-400">{{ t('common.dash') }}</span>
            </td>
            <td class="text-end whitespace-nowrap">
              <RouterLink v-if="auth.can('orders.view')" :to="`/orders/${row.id}`" class="text-accent hover:underline">{{ t('common.open') }}</RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
      <div class="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h2 class="text-sm font-medium">{{ t('nav.invoices') }} <span class="font-normal text-slate-400">{{ totals.invoices || 0 }}</span></h2>
      </div>
      <EmptyState v-if="!client.invoices?.length" :title="t('clients.noInvoices')" />
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>{{ t('common.invoice') }}</th>
            <th>{{ t('invoices.order') }}</th>
            <th>{{ t('clients.createdOn') }}</th>
            <th>{{ t('common.status') }}</th>
            <th>{{ t('invoices.total') }}</th>
            <th>{{ t('contracts.paid') }}</th>
            <th>{{ t('contracts.remaining') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in client.invoices" :key="row.id">
            <td class="font-medium" :data-label="t('common.invoice')">#{{ row.id }}</td>
            <td :data-label="t('invoices.order')">
              <RouterLink v-if="auth.can('orders.view')" :to="`/orders/${row.order_id}`" class="text-accent hover:underline">#{{ row.order_id }}</RouterLink>
              <span v-else>#{{ row.order_id }}</span>
            </td>
            <td class="tabular-nums" :data-label="t('clients.createdOn')">{{ fmtDate(row.created_at) }}</td>
            <td :data-label="t('common.status')"><Badge variant="secondary">{{ named('invoiceStatus', row.status) }}</Badge></td>
            <td class="tabular-nums" :data-label="t('invoices.total')">{{ row.total }}</td>
            <td class="tabular-nums" :data-label="t('contracts.paid')">{{ row.paid }}</td>
            <td :data-label="t('contracts.remaining')" :class="remainingAmountClass(Number(row.remaining || 0))">{{ row.remaining }}</td>
            <td class="text-end whitespace-nowrap">
              <Button v-if="canCollect(row)" variant="outline" size="sm" class="me-1" @click="startCollect('invoice', row.id)">
                <Wallet class="size-3.5" /> {{ t('contracts.collect') }}
              </Button>
              <RouterLink v-if="auth.can('invoices.view')" :to="`/invoices/${row.id}`" class="text-accent hover:underline">{{ t('common.open') }}</RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
      <div class="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h2 class="text-sm font-medium">{{ t('contracts.installments') }}</h2>
      </div>
      <EmptyState v-if="!client.installments?.length" :title="t('clients.noInstallments')" />
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>{{ t('nav.contracts') }}</th>
            <th>{{ t('contracts.due') }}</th>
            <th>{{ t('contracts.description') }}</th>
            <th>{{ t('contracts.amount') }}</th>
            <th>{{ t('contracts.paid') }}</th>
            <th>{{ t('contracts.remaining') }}</th>
            <th>{{ t('common.status') }}</th>
            <th v-if="auth.can('payments.collect')"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in client.installments" :key="row.id" :class="dueTone(row, today) === 'overdue' && 'bg-amber-50/70 dark:bg-amber-950/20'">
            <td :data-label="t('nav.contracts')">
              <RouterLink v-if="auth.can('contracts.view')" :to="`/contracts/${row.contract_id}`" class="text-accent hover:underline">#{{ row.contract_id }}</RouterLink>
              <span v-else>#{{ row.contract_id }}</span>
            </td>
            <td class="tabular-nums" :data-label="t('contracts.due')">
              {{ fmtDate(row.due_date) }}
              <Badge v-if="dueTone(row, today) === 'overdue'" variant="outline" class="ms-1">{{ t('clients.overdue') }}</Badge>
              <Badge v-else-if="dueTone(row, today) === 'today'" variant="secondary" class="ms-1">{{ t('clients.dueToday') }}</Badge>
            </td>
            <td :data-label="t('contracts.description')">{{ row.description || t('common.dash') }}</td>
            <td class="tabular-nums" :data-label="t('contracts.amount')">{{ row.amount }}</td>
            <td class="tabular-nums" :data-label="t('contracts.paid')">{{ row.paid }}</td>
            <td :data-label="t('contracts.remaining')" :class="remainingAmountClass(Number(row.remaining || 0))">{{ row.remaining }}</td>
            <td :data-label="t('common.status')">{{ named('installmentStatus', row.status) }}</td>
            <td v-if="auth.can('payments.collect')" class="text-end">
              <Button v-if="canCollect(row)" variant="outline" size="sm" @click="startCollect('installment', row.id)">
                <Wallet class="size-3.5" /> {{ t('contracts.collect') }}
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
      <div class="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h2 class="text-sm font-medium">{{ t('clients.payments') }}</h2>
        <PdfExportButton size="sm" :disabled="!client.payments?.length" @click="exportPayments" />
      </div>
      <EmptyState v-if="!client.payments?.length" :title="t('clients.noPayments')" />
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>{{ t('contracts.amount') }}</th>
            <th>{{ t('tech.method') }}</th>
            <th>{{ t('clients.appliedTo') }}</th>
            <th>{{ t('contracts.collectedBy') }}</th>
            <th>{{ t('contracts.collectedAt') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in client.payments" :key="row.id">
            <td class="font-medium tabular-nums" :data-label="t('contracts.amount')">{{ row.amount }}</td>
            <td :data-label="t('tech.method')">{{ paymentMethodLabel(row) }}</td>
            <td :data-label="t('clients.appliedTo')">
              <template v-if="row.allocations?.length">
                <template v-for="(alloc, idx) in row.allocations" :key="alloc.id || idx">
                  <span v-if="idx"> · </span>
                  <RouterLink
                    v-if="alloc.invoice_id && auth.can('invoices.view')"
                    :to="`/invoices/${alloc.invoice_id}`"
                    class="text-accent hover:underline"
                  >
                    {{ t('clients.forInvoice', { id: alloc.invoice_id }) }}
                  </RouterLink>
                  <span v-else-if="alloc.invoice_id">{{ t('clients.forInvoice', { id: alloc.invoice_id }) }}</span>
                  <RouterLink
                    v-else-if="alloc.installment_id && alloc.contract_id && auth.can('contracts.view')"
                    :to="`/contracts/${alloc.contract_id}`"
                    class="text-accent hover:underline"
                  >
                    {{ t('clients.forInstallment') }}
                  </RouterLink>
                  <span v-else-if="alloc.installment_id">{{ t('clients.forInstallment') }}</span>
                  <span v-else>{{ t('clients.asCredit') }}</span>
                </template>
              </template>
              <span v-else>{{ t('clients.asCredit') }}</span>
              <p v-if="row.notes" class="mt-0.5 text-xs text-slate-500">{{ row.notes }}</p>
            </td>
            <td :data-label="t('contracts.collectedBy')">
              {{ personName(row.receiver) }}
              <p
                v-if="row.creator && row.receiver?.id && row.creator.id !== row.receiver.id"
                class="text-xs text-slate-500"
              >
                {{ t('common.createdBy') }} {{ personName(row.creator) }}
              </p>
            </td>
            <td class="tabular-nums" :data-label="t('contracts.collectedAt')">{{ fmtDate(row.created_at) }}</td>
            <td class="text-end">
              <div class="flex items-center justify-end gap-1">
                <PdfExportButton size="sm" @click="exportReceipt(row)" />
                <ConversationActions
                  v-if="row.payment_id"
                  type="payment"
                  :id="row.payment_id"
                  size="sm"
                  :follow-hash="false"
                  :start-with="Number(route.query.payment) === row.payment_id ? 'comments' : ''"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <ReceivePaymentDialog
      v-model:open="payOpen"
      :client-id="client.id"
      :wallet="wallet"
      :dues="dues"
      :preset="payPreset"
      :mode="payMode"
      @saved="load(true)"
    />
  </div>
</template>
