<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { MapPin, Wallet } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import { apiError, fmtDate, remainingAmountClass } from '@/lib/utils'
import { named, personName, departmentName } from '@/i18n'
import { formatPhone, phoneDigits } from '@/lib/phone'
import { machineLabel } from '@/lib/machines'
import { invoicePaidAmount, invoiceRemaining, orderDraftInvoice, orderInvoices } from '@/lib/orderInvoices'
import StatusBadge from '@/components/StatusBadge.vue'
import FormDialog from '@/components/FormDialog.vue'
import InvoiceDraftDialog from '@/components/InvoiceDraftDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageHeader from '@/components/PageHeader.vue'
import ActionMenu from '@/components/ActionMenu.vue'
import EmptyState from '@/components/EmptyState.vue'
import OrderTimeline from '@/components/OrderTimeline.vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import Field from '@/components/ui/Field.vue'
import ConversationActions from '@/components/ConversationActions.vue'
import ReceivePaymentDialog, { type PaymentDue } from '@/components/ReceivePaymentDialog.vue'
import PhoneActions from '@/components/PhoneActions.vue'
import { useAuthStore } from '@/stores/auth'
import { useStaffReload } from '@/composables/useStaffEvent'
import { useReceivePayment } from '@/composables/useReceivePayment'

const { t } = useI18n()
const auth = useAuthStore()
const order = ref<any>(null)
const editOpen = ref(false)
const invoiceOpen = ref(false)
const deleteOpen = ref(false)
const { payOpen, payPreset, startCollect: collect } = useReceivePayment()
const notes = ref('')
const error = ref('')
const loading = ref(true)
const saving = ref(false)
const confirming = ref(false)
const route = useRoute()

async function load(quiet = false) {
  if (!quiet) {
    loading.value = true
    error.value = ''
    order.value = null
  }
  try {
    order.value = (await api.get(`/api/orders/${route.params.id}`)).data
  } catch (e) {
    if (!quiet) error.value = apiError(e)
  } finally {
    if (!quiet) loading.value = false
  }
}

function startEdit() {
  notes.value = order.value.notes || ''
  error.value = ''
  editOpen.value = true
}

async function save() {
  if (saving.value) return
  error.value = ''
  saving.value = true
  try {
    await api.put(`/api/orders/${order.value.id}`, { notes: notes.value })
    editOpen.value = false
    await load(true)
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}

const invoiceDocId = ref<number | null>(null)
const invoices = computed(() => orderInvoices(order.value))
const draft = computed(() => orderDraftInvoice(order.value))
const netDue = computed(() => Number(order.value?.net_due || 0))
const wallet = computed(() => Number(order.value?.client?.wallet || 0))
const invoiced = computed(() => invoices.value
  .filter((inv: any) => inv.status === 'confirmed')
  .reduce((n: number, inv: any) => n + Number(inv.total || 0), 0))
const paid = computed(() => invoices.value
  .filter((inv: any) => inv.status === 'confirmed')
  .reduce((n: number, inv: any) => n + invoicePaidAmount(inv), 0))

const dues = computed<PaymentDue[]>(() =>
  invoices.value
    .filter((inv: any) => invoiceRemaining(inv) > 0)
    .map((inv: any) => ({
      type: 'invoice' as const,
      id: inv.id,
      remaining: invoiceRemaining(inv),
      label: t('clients.forInvoice', { id: inv.id }),
    })),
)

function canCreateInvoice() {
  if (!order.value || order.value.status === 'completed' || order.value.status === 'cancelled') return false
  return auth.can('invoices.create')
}

function canEditDraft() {
  return !!draft.value && auth.canAny('invoices.update', 'invoices.confirm')
}

function canCollect(inv: any) {
  return auth.can('payments.collect') && invoiceRemaining(inv) > 0
}

function openInvoice(id: number | null) {
  invoiceDocId.value = id
  invoiceOpen.value = true
}

function startCollect(inv: { id: number }) {
  collect('invoice', inv.id)
}

function openReceive() {
  const inv = invoices.value.find((row: any) => invoiceRemaining(row) > 0)
  if (inv) startCollect(inv)
}

const extraActions = computed(() => [
  {
    id: 'notes',
    label: t('orders.editNotes'),
    show: order.value && order.value.status !== 'completed' && order.value.status !== 'cancelled' && auth.can('orders.update'),
  },
  {
    id: 'delete-invoice',
    label: t('invoices.deleteInvoice'),
    danger: true,
    show: !!draft.value && auth.can('invoices.delete'),
  },
])

function onExtra(id: string) {
  if (id === 'notes') startEdit()
  if (id === 'delete-invoice') deleteOpen.value = true
}

async function deleteDraft() {
  if (!draft.value || confirming.value) return
  error.value = ''
  confirming.value = true
  try {
    await api.delete(`/api/invoices/${draft.value.id}`)
    deleteOpen.value = false
    await load(true)
  } catch (e) {
    error.value = apiError(e)
    deleteOpen.value = false
  } finally {
    confirming.value = false
  }
}

function fmtWhen(value?: string | null) {
  if (!value) return t('common.dash')
  return String(value).replace('T', ' ').slice(0, 16)
}

function sourceLabel(source?: string | null) {
  if (source === 'contract_schedule') return t('orders.sourceContract')
  return t('orders.sourceManual')
}

watch(() => route.params.id, () => { void load() }, { immediate: true })

useStaffReload((e) => {
  const id = Number(route.params.id)
  if (e.kind === 'order') return Number(e.order_id) === id
  return e.kind === 'conversation' && e.type === 'order' && Number(e.id) === id
}, () => load(true))
</script>

<template>
  <div v-if="loading" class="text-sm text-slate-500">{{ t('orders.loading') }}</div>
  <div v-else-if="error && !order" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
    {{ error }}
    <RouterLink to="/orders" class="ms-2 text-accent hover:underline">{{ t('orders.allOrders') }}</RouterLink>
  </div>
  <div v-else-if="order" class="space-y-6">
    <PageHeader :title="t('orders.showTitle', { id: order.id })" :back-to="'/orders'" :back-label="t('orders.allOrders')">
      <template #meta>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge :status="order.status" />
          <span class="text-sm text-slate-500">{{ order.client?.name }}</span>
        </div>
      </template>
      <template #actions>
        <Button v-if="canEditDraft()" @click="openInvoice(draft.id)">
          {{ t('dispatch.invoiceTitle') }}
        </Button>
        <Button v-else-if="canCreateInvoice()" @click="openInvoice(null)">
          {{ t('tech.createInvoice') }}
        </Button>
        <Button v-if="auth.can('payments.collect') && dues.length" variant="outline" @click="openReceive()">
          <Wallet class="size-4" /> {{ t('clients.receivePayment') }}
        </Button>
        <ConversationActions type="order" :id="order.id" />
        <ActionMenu :items="extraActions" @select="onExtra" />
      </template>
    </PageHeader>

    <p v-if="error && !editOpen" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      {{ error }}
    </p>

    <div class="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(17rem,1fr)]">
      <article class="panel p-5">
        <h2 class="text-sm font-medium">{{ t('orders.details') }}</h2>
        <dl class="meta-grid mt-4">
          <div>
            <dt>{{ t('common.client') }}</dt>
            <dd>
              <RouterLink
                v-if="auth.can('clients.view') && order.client_id"
                :to="`/clients/${order.client_id}`"
                class="text-accent hover:underline"
              >
                {{ order.client?.name }}
              </RouterLink>
              <span v-else>{{ order.client?.name || t('common.dash') }}</span>
            </dd>
          </div>
          <div>
            <dt>{{ t('orders.contactPhone') }}</dt>
            <dd>
              <div v-if="order.phone && phoneDigits(order.phone)" class="flex items-center justify-between gap-3">
                <p class="tabular-nums">{{ formatPhone(order.phone) }}</p>
                <PhoneActions :phone="order.phone" />
              </div>
              <span v-else>{{ formatPhone(order.phone) || t('common.dash') }}</span>
            </dd>
          </div>
          <div>
            <dt>{{ t('common.department') }}</dt>
            <dd>{{ departmentName(order.department) }}</dd>
          </div>
          <div>
            <dt>{{ t('orders.assignedTo') }}</dt>
            <dd>{{ personName(order.technician, t('orders.unassigned')) }}</dd>
          </div>
          <div v-if="order.contract">
            <dt>{{ t('orders.contract') }}</dt>
            <dd>
              <RouterLink
                v-if="auth.can('contracts.view')"
                :to="`/contracts/${order.contract.id}`"
                class="text-accent hover:underline"
              >
                {{ named('contractType', order.contract.type) }} #{{ order.contract.id }}
              </RouterLink>
              <span v-else>{{ named('contractType', order.contract.type) }} #{{ order.contract.id }}</span>
            </dd>
          </div>
          <div>
            <dt>{{ t('accounting.source') }}</dt>
            <dd>{{ sourceLabel(order.source) }}</dd>
          </div>
          <div>
            <dt>{{ t('orders.createdBy') }}</dt>
            <dd>{{ personName(order.creator) }}</dd>
          </div>
          <div>
            <dt>{{ t('orders.createdDate') }}</dt>
            <dd class="tabular-nums">{{ fmtWhen(order.created_at) }}</dd>
          </div>
          <div>
            <dt>{{ t('contracts.plannedDate') }}</dt>
            <dd class="tabular-nums">{{ fmtDate(order.planned_date) }}</dd>
          </div>
          <div v-if="order.accepted_at">
            <dt>{{ t('orders.acceptedAt') }}</dt>
            <dd class="tabular-nums">{{ fmtWhen(order.accepted_at) }}</dd>
          </div>
          <div v-if="order.reached_at">
            <dt>{{ t('orders.reachedAt') }}</dt>
            <dd class="tabular-nums">{{ fmtWhen(order.reached_at) }}</dd>
          </div>
          <div v-if="order.completed_at">
            <dt>{{ t('orders.completedAt') }}</dt>
            <dd class="tabular-nums">{{ fmtWhen(order.completed_at) }}</dd>
          </div>
        </dl>
        <p
          v-if="order.notes"
          class="mt-4 rounded-lg border-s-[3px] border-accent bg-slate-50 px-3 py-2 text-sm leading-relaxed dark:bg-slate-800/50"
        >
          {{ order.notes }}
        </p>
      </article>

      <article class="panel p-5" :class="netDue > 0 && 'border-amber-300 dark:border-amber-800'">
        <h2 class="text-sm font-medium">{{ t('orders.billing') }}</h2>
        <p class="mt-3 text-[0.7rem] font-medium tracking-wider text-slate-500 uppercase">{{ t('clients.netDue') }}</p>
        <p class="mt-0.5 text-3xl font-semibold tabular-nums" :class="netDue > 0 ? 'text-amber-800 dark:text-amber-200' : ''">
          {{ netDue > 0 ? netDue : t('clients.settled') }}
        </p>
        <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt class="text-xs text-slate-500">{{ t('clients.invoiced') }}</dt>
            <dd class="mt-0.5 tabular-nums">{{ invoiced }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">{{ t('contracts.paid') }}</dt>
            <dd class="mt-0.5 tabular-nums">{{ paid }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">{{ t('nav.invoices') }}</dt>
            <dd class="mt-0.5">{{ invoices.length }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-500">{{ t('clients.wallet') }}</dt>
            <dd class="mt-0.5 tabular-nums">{{ wallet }}</dd>
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
            <p class="text-sm font-medium">{{ order.location?.label || t('common.dash') }}</p>
            <p class="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {{ order.location?.address || t('clients.noAddress') }}
            </p>
            <p v-if="order.location?.paci_number" class="mt-1 text-xs tabular-nums text-slate-500">
              {{ t('address.paci') }} {{ order.location.paci_number }}
            </p>
          </div>
          <a
            v-if="order.location?.google_maps_link"
            :href="order.location.google_maps_link"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            <MapPin class="size-3.5" />
            {{ t('tech.openMaps') }}
          </a>
        </div>
        <table v-if="order.location?.machines?.length" class="mt-4 w-full text-sm">
          <thead>
            <tr class="text-left text-[0.7rem] tracking-wider text-slate-500 uppercase">
              <th class="pb-1 font-medium">{{ t('clients.machine') }}</th>
              <th class="pb-1 font-medium">{{ t('clients.serial') }}</th>
              <th class="pb-1 font-medium">{{ t('common.notes') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in order.location.machines" :key="m.id" class="border-t border-slate-100 dark:border-slate-800">
              <td class="py-1.5">{{ machineLabel(m) }}</td>
              <td class="py-1.5 tabular-nums text-slate-600 dark:text-slate-300">{{ m.serial || t('common.dash') }}</td>
              <td class="py-1.5 text-slate-500">{{ m.notes || t('common.dash') }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="mt-3 text-xs text-slate-400">{{ t('clients.noMachines') }}</p>
      </div>
    </section>

    <section class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
      <div class="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h2 class="text-sm font-medium">{{ t('nav.invoices') }} <span class="font-normal text-slate-400">{{ invoices.length }}</span></h2>
        <Button v-if="canCreateInvoice() && !draft" variant="outline" size="sm" @click="openInvoice(null)">
          {{ t('tech.createInvoice') }}
        </Button>
      </div>
      <EmptyState v-if="!invoices.length" :title="t('clients.noInvoices')" />
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>{{ t('common.invoice') }}</th>
            <th>{{ t('clients.createdOn') }}</th>
            <th>{{ t('common.status') }}</th>
            <th>{{ t('invoices.total') }}</th>
            <th>{{ t('contracts.paid') }}</th>
            <th>{{ t('contracts.remaining') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="inv in invoices" :key="inv.id">
            <td class="font-medium" :data-label="t('common.invoice')">#{{ inv.id }}</td>
            <td class="tabular-nums" :data-label="t('clients.createdOn')">{{ fmtDate(inv.created_at) }}</td>
            <td :data-label="t('common.status')"><Badge variant="secondary">{{ named('invoiceStatus', inv.status) }}</Badge></td>
            <td class="tabular-nums" :data-label="t('invoices.total')">{{ inv.total }}</td>
            <td class="tabular-nums" :data-label="t('contracts.paid')">{{ invoicePaidAmount(inv) }}</td>
            <td :data-label="t('contracts.remaining')" :class="remainingAmountClass(invoiceRemaining(inv))">{{ invoiceRemaining(inv) }}</td>
            <td class="text-end whitespace-nowrap">
              <Button v-if="canCollect(inv)" variant="outline" size="sm" class="me-1" @click="startCollect(inv)">
                <Wallet class="size-3.5" /> {{ t('contracts.collect') }}
              </Button>
              <Button v-if="inv.status === 'draft' && canEditDraft()" variant="outline" size="sm" class="me-1" @click="openInvoice(inv.id)">
                {{ t('common.edit') }}
              </Button>
              <RouterLink v-if="auth.can('invoices.view')" :to="`/invoices/${inv.id}`" class="text-accent hover:underline">{{ t('common.open') }}</RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="panel p-5">
      <h2 class="mb-4 text-sm font-medium">{{ t('orders.timeline') }}</h2>
      <OrderTimeline :items="order.status_history" />
    </section>
  </div>

  <InvoiceDraftDialog
    v-model:open="invoiceOpen"
    :order-id="order?.id"
    :invoice-id="invoiceDocId"
    @saved="load(true)"
  />

  <FormDialog v-model:open="editOpen" :title="t('orders.notesTitle')" :submit-label="t('common.save')" :error="error" :loading="saving" @submit="save">
    <Field :label="t('common.notes')"><Input v-model="notes" /></Field>
  </FormDialog>

  <ConfirmDialog
    v-model:open="deleteOpen"
    :title="t('invoices.deleteTitle')"
    :description="t('invoices.deleteDesc')"
    :confirm-label="t('common.delete')"
    variant="destructive"
    :loading="confirming"
    @confirm="deleteDraft"
  />

  <ReceivePaymentDialog
    v-model:open="payOpen"
    :client-id="order?.client_id ?? null"
    :wallet="wallet"
    :dues="dues"
    :preset="payPreset"
    mode="receive"
    @saved="load(true)"
  />
</template>
