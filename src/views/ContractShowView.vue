<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { MapPin, Pencil, Wallet } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import { apiError, fmtDate, remainingAmountClass } from '@/lib/utils'
import { named, personName, departmentName } from '@/i18n'
import { formatPhone } from '@/lib/phone'
import { dueTone, paymentMethodLabel } from '@/lib/payments'
import { orderInvoices } from '@/lib/orderInvoices'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import PageHeader from '@/components/PageHeader.vue'
import ConversationActions from '@/components/ConversationActions.vue'
import EmptyState from '@/components/EmptyState.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import PdfExportButton from '@/components/PdfExportButton.vue'
import PhoneActions from '@/components/PhoneActions.vue'
import ReceivePaymentDialog, { type PaymentDue } from '@/components/ReceivePaymentDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useModalsStore } from '@/stores/modals'
import { usePdfStore } from '@/stores/pdf'
import { useReceivePayment } from '@/composables/useReceivePayment'
import LoadingState from '@/components/LoadingState.vue'

const { t } = useI18n()
const auth = useAuthStore()
const modals = useModalsStore()
const pdf = usePdfStore()
const route = useRoute()
const detail = ref<any>(null)
const error = ref('')
const loading = ref(true)
const { payOpen, payMode, payPreset, openReceive: receive, openApply: apply, startCollect: collect } = useReceivePayment()

async function load(quiet = false) {
  if (!quiet) {
    loading.value = true
    error.value = ''
    detail.value = null
  }
  try {
    detail.value = (await api.get(`/api/contracts/${route.params.id}`)).data
  } catch (e) {
    if (!quiet) error.value = apiError(e)
  } finally {
    if (!quiet) loading.value = false
  }
}

function startEdit() {
  if (!detail.value) return
  modals.editContract(detail.value.id)
}

function exportDetail() {
  if (!detail.value) return
  pdf.openContractPicker({
    title: t('pdf.contract', { id: detail.value.reference_no || `#${detail.value.id}` }),
    filename: `contract-${detail.value.id}`,
    contract: detail.value,
  })
}

function paidSum(row: any) {
  return (row.allocations || []).reduce((n: number, p: any) => n + Number(p.amount || 0), 0)
}

function remaining(row: any) {
  return Math.max(0, Number(row.amount || 0) - paidSum(row))
}

function canCollect(row: any) {
  return auth.can('payments.collect') && remaining(row) > 0
}

function yesNo(value: boolean | number | null | undefined) {
  return value ? t('common.yes') : t('common.no')
}

const today = computed(() => {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
})

const phones = computed(() =>
  [...(detail.value?.client?.phones || [])].sort((a: any, b: any) => Number(b.is_primary) - Number(a.is_primary)),
)
const netDue = computed(() => Number(detail.value?.net_due || 0))
const wallet = computed(() => Number(detail.value?.client?.wallet || 0))
const outstanding = computed(() =>
  (detail.value?.installments || []).reduce((n: number, row: any) => n + remaining(row), 0),
)
const collected = computed(() =>
  (detail.value?.installments || []).reduce((n: number, row: any) => n + paidSum(row), 0),
)

const dues = computed<PaymentDue[]>(() =>
  (detail.value?.installments || [])
    .filter((row: any) => remaining(row) > 0)
    .map((row: any, idx: number) => ({
      type: 'installment' as const,
      id: row.id,
      remaining: remaining(row),
      label: t('contracts.installmentN', { n: idx + 1 }),
    })),
)

function startCollect(row: { id: number }) {
  collect('installment', row.id)
}

function openReceive() {
  const first = (detail.value?.installments || []).find((row: any) => remaining(row) > 0)
  receive(first ? { type: 'installment', id: first.id } : { type: 'credit' })
}

function openApply() {
  apply()
}

watch(() => route.params.id, () => { void load() }, { immediate: true })
watch(() => modals.savedAt, () => {
  if (modals.savedKind === 'contract' && modals.savedId === Number(route.params.id)) {
    void load(true)
  }
})
</script>

<template>
  <LoadingState v-if="loading" :label="t('contracts.loading')" />
  <div v-else-if="error" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
    {{ error }}
    <RouterLink to="/contracts" class="ms-2 text-accent hover:underline">{{ t('contracts.allContracts') }}</RouterLink>
  </div>
  <div v-else-if="detail" class="space-y-6">
    <PageHeader :title="t('contracts.detailsTitleId', { id: detail.reference_no || `#${detail.id}` })" :back-to="'/contracts'" :back-label="t('contracts.allContracts')">
      <template #meta>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{{ named('contractType', detail.type) }}</Badge>
          <Badge
            variant="secondary"
            :class="detail.status === 'active'
              ? 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
              : detail.status === 'expired'
                ? 'border-transparent bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200'
                : ''"
          >{{ named('contractStatus', detail.status) }}</Badge>
          <span class="text-sm text-slate-500">{{ detail.client?.name }}</span>
        </div>
      </template>
      <template #actions>
        <PdfExportButton @click="exportDetail" />
        <Button v-if="auth.can('payments.collect')" variant="outline" @click="openReceive()">
          <Wallet class="size-4" /> {{ t('clients.receivePayment') }}
        </Button>
        <Button v-if="auth.can('payments.collect') && wallet > 0 && dues.length" variant="outline" @click="openApply()">
          {{ t('clients.applyCredit') }}
        </Button>
        <ConversationActions type="contract" :id="detail.id" />
        <Button v-if="auth.can('contracts.update')" variant="outline" @click="startEdit">
          <Pencil class="size-4" /> {{ t('common.edit') }}
        </Button>
      </template>
    </PageHeader>

    <div class="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(17rem,1fr)]">
      <article class="panel p-5">
        <h2 class="text-sm font-medium">{{ t('clients.profile') }}</h2>
        <dl class="meta-grid mt-4">
          <div>
            <dt>{{ t('common.client') }}</dt>
            <dd>
              <RouterLink
                v-if="auth.can('clients.view') && detail.client_id"
                :to="`/clients/${detail.client_id}`"
                class="text-accent hover:underline"
              >
                {{ detail.client?.name }}
              </RouterLink>
              <span v-else>{{ detail.client?.name || t('common.dash') }}</span>
            </dd>
          </div>
          <div>
            <dt>{{ t('clients.phones') }}</dt>
            <dd>
              <p v-if="!phones.length" class="text-slate-400">{{ t('clients.noPhone') }}</p>
              <ul v-else class="space-y-2">
                <li v-for="phone in phones" :key="phone.id" class="flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <p dir="ltr" class="phone-num tabular-nums">{{ formatPhone(phone) }}</p>
                    <Badge v-if="phone.is_primary" variant="secondary" class="mt-1">{{ t('clients.primary') }}</Badge>
                  </div>
                    <PhoneActions :phone="phone" />
                </li>
              </ul>
            </dd>
          </div>
          <div>
            <dt>{{ t('common.department') }}</dt>
            <dd>{{ departmentName(detail.department) }}</dd>
          </div>
          <div>
            <dt>{{ t('contracts.period') }}</dt>
            <dd class="tabular-nums">{{ fmtDate(detail.start_date) }} – {{ fmtDate(detail.end_date) }}</dd>
          </div>
          <div>
            <dt>{{ t('contracts.spareParts') }}</dt>
            <dd>{{ yesNo(detail.type === 'warranty' || detail.includes_spare_parts) }}</dd>
          </div>
          <div>
            <dt>{{ t('contracts.compressor') }}</dt>
            <dd>
              <p>{{ yesNo(detail.includes_compressor_warranty) }}</p>
              <p
                v-if="detail.includes_compressor_warranty"
                class="mt-0.5 text-xs tabular-nums text-slate-500"
              >
                {{ fmtDate(detail.compressor_warranty_start) }} – {{ fmtDate(detail.compressor_warranty_end) }}
              </p>
            </dd>
          </div>
          <div>
            <dt>{{ t('common.createdBy') }}</dt>
            <dd>{{ personName(detail.creator) }}</dd>
          </div>
          <div>
            <dt>{{ t('contracts.created') }}</dt>
            <dd class="tabular-nums">{{ fmtDate(detail.created_at) }}</dd>
          </div>
        </dl>
        <p
          v-if="detail.client?.notes"
          class="mt-4 rounded-lg border-s-[3px] border-accent bg-slate-50 px-3 py-2 text-sm leading-relaxed dark:bg-slate-800/50"
        >
          {{ detail.client.notes }}
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
            <dd class="mt-0.5 tabular-nums">{{ wallet }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">{{ t('contracts.contractValue') }}</dt>
            <dd class="mt-0.5 tabular-nums">{{ detail.total_amount || 0 }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">{{ t('clients.collected') }}</dt>
            <dd class="mt-0.5 tabular-nums">{{ collected }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">{{ t('contracts.installments') }}</dt>
            <dd class="mt-0.5">{{ detail.installments?.length || 0 }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">{{ t('contracts.visits') }}</dt>
            <dd class="mt-0.5">{{ detail.orders?.length || 0 }} <span class="text-slate-400">{{ t('clients.ofTotal', { n: detail.planned_visits || 0 }) }}</span></dd>
          </div>
        </dl>
      </article>
    </div>

    <section class="panel">
      <div class="border-b border-slate-200 px-5 py-3 dark:border-slate-700">
        <h2 class="text-sm font-medium">{{ t('common.location') }}</h2>
      </div>
      <div class="p-5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium">{{ detail.location?.label || t('common.dash') }}</p>
            <p class="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {{ detail.location?.address || t('clients.noAddress') }}
            </p>
            <p v-if="detail.location?.paci_number" class="mt-1 text-xs tabular-nums text-slate-500">
              {{ t('address.paci') }} {{ detail.location.paci_number }}
            </p>
          </div>
          <a
            v-if="detail.location?.google_maps_link"
            :href="detail.location.google_maps_link"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            <MapPin class="size-3.5" />
            {{ t('tech.openMaps') }}
          </a>
        </div>
      </div>
    </section>

    <section class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
      <div class="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h2 class="text-sm font-medium">{{ t('contracts.coveredMachines') }}</h2>
      </div>
      <EmptyState v-if="!detail.machines?.length" :title="t('contracts.noCoveredMachines')" />
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>{{ t('clients.brand') }}</th>
            <th>{{ t('clients.model') }}</th>
            <th>{{ t('clients.serial') }}</th>
            <th>{{ t('common.notes') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in detail.machines" :key="m.id">
            <td :data-label="t('clients.brand')">{{ m.brand || t('common.dash') }}</td>
            <td :data-label="t('clients.model')">{{ m.model || t('common.dash') }}</td>
            <td class="tabular-nums" :data-label="t('clients.serial')">{{ m.serial || t('common.dash') }}</td>
            <td :data-label="t('common.notes')">{{ m.notes || t('common.dash') }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
      <div class="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h2 class="text-sm font-medium">{{ t('contracts.visits') }} <span class="font-normal text-slate-400">{{ detail.orders?.length || 0 }}</span></h2>
      </div>
      <EmptyState v-if="!detail.orders?.length" :title="t('contracts.noVisits')" />
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>{{ t('orders.id') }}</th>
            <th>{{ t('contracts.plannedDate') }}</th>
            <th>{{ t('common.status') }}</th>
            <th>{{ t('common.technician') }}</th>
            <th>{{ t('nav.invoices') }}</th>
            <th>{{ t('common.notes') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in detail.orders" :key="o.id">
            <td class="font-medium" :data-label="t('orders.id')">
              <RouterLink v-if="auth.can('orders.view')" :to="`/orders/${o.id}`" class="text-accent hover:underline">#{{ o.id }}</RouterLink>
              <span v-else>#{{ o.id }}</span>
            </td>
            <td class="tabular-nums" :data-label="t('contracts.plannedDate')">{{ fmtDate(o.planned_date) }}</td>
            <td :data-label="t('common.status')"><StatusBadge :status="o.status" /></td>
            <td :data-label="t('common.technician')">{{ personName(o.technician) }}</td>
            <td :data-label="t('nav.invoices')">
              <template v-if="orderInvoices(o).length && auth.can('invoices.view')">
                <RouterLink
                  v-for="inv in orderInvoices(o)"
                  :key="inv.id"
                  :to="`/invoices/${inv.id}`"
                  class="me-2 text-accent hover:underline"
                >#{{ inv.id }}</RouterLink>
              </template>
              <span v-else-if="orderInvoices(o).length">{{ orderInvoices(o).map((inv: any) => `#${inv.id}`).join(' · ') }}</span>
              <span v-else class="text-slate-400">{{ t('common.dash') }}</span>
            </td>
            <td :data-label="t('common.notes')">{{ o.notes || t('common.dash') }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
      <div class="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h2 class="text-sm font-medium">{{ t('contracts.installments') }}</h2>
      </div>
      <EmptyState v-if="!detail.installments?.length" :title="t('clients.noInstallments')" />
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>#</th>
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
          <template v-for="(i, idx) in detail.installments" :key="i.id">
            <tr :class="dueTone(i, today, remaining(i)) === 'overdue' && 'bg-amber-50/70 dark:bg-amber-950/20'">
              <td :data-label="'#'">{{ Number(idx) + 1 }}</td>
              <td class="tabular-nums" :data-label="t('contracts.due')">
                {{ fmtDate(i.due_date) }}
                <Badge v-if="dueTone(i, today, remaining(i)) === 'overdue'" variant="outline" class="ms-1">{{ t('clients.overdue') }}</Badge>
                <Badge v-else-if="dueTone(i, today, remaining(i)) === 'today'" variant="secondary" class="ms-1">{{ t('clients.dueToday') }}</Badge>
              </td>
              <td :data-label="t('contracts.description')">{{ i.description || t('common.dash') }}</td>
              <td class="tabular-nums" :data-label="t('contracts.amount')">{{ i.amount }}</td>
              <td class="tabular-nums" :data-label="t('contracts.paid')">{{ paidSum(i) }}</td>
              <td :data-label="t('contracts.remaining')" :class="remainingAmountClass(remaining(i))">{{ remaining(i) }}</td>
              <td :data-label="t('common.status')">{{ named('installmentStatus', i.status) }}</td>
              <td v-if="auth.can('payments.collect')" class="text-end">
                <Button v-if="canCollect(i)" variant="outline" size="sm" @click="startCollect(i)">
                  <Wallet class="size-3.5" /> {{ t('contracts.collect') }}
                </Button>
              </td>
            </tr>
            <tr v-if="i.allocations?.length">
              <td :colspan="auth.can('payments.collect') ? 8 : 7" class="bg-slate-50 p-0 dark:bg-slate-800/40">
                <p class="px-3 pt-2 text-xs font-medium text-slate-500">{{ t('contracts.paymentsFor', { n: Number(idx) + 1 }) }}</p>
                <table class="data-table">
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
                    <tr v-for="p in i.allocations" :key="p.id">
                      <td class="tabular-nums">{{ p.amount }}</td>
                      <td>{{ paymentMethodLabel(p) }}</td>
                      <td>{{ personName(p.applier) }}</td>
                      <td class="tabular-nums">{{ fmtDate(p.created_at) }}</td>
                      <td>{{ p.payment?.notes || t('common.dash') }}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </section>
  </div>

  <ReceivePaymentDialog
    v-model:open="payOpen"
    :client-id="detail?.client_id ?? null"
    :wallet="wallet"
    :dues="dues"
    :preset="payPreset"
    :mode="payMode"
    @saved="load(true)"
  />
</template>
