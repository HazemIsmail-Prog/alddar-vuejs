<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ClipboardList, Plus, X } from '@lucide/vue'
import { useDebounceFn } from '@vueuse/core'
import api from '@/api/client'
import { apiError } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import Field from '@/components/ui/Field.vue'
import FormDialog from '@/components/FormDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import InvoiceDraftDialog from '@/components/InvoiceDraftDialog.vue'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import LoadingState from '@/components/LoadingState.vue'
import ActionMenu from '@/components/ActionMenu.vue'
import ConversationActions from '@/components/ConversationActions.vue'
import FilterGroup from '@/components/FilterGroup.vue'
import FilterMulti from '@/components/FilterMulti.vue'
import FilterSelect from '@/components/FilterSelect.vue'
import FilterDateRange from '@/components/FilterDateRange.vue'
import OrderDetailsCard from '@/components/OrderDetailsCard.vue'
import { personName, departmentName } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useModalsStore } from '@/stores/modals'
import { useStatusStore } from '@/stores/statuses'
import { useInboxStore } from '@/stores/inbox'
import { useStaffReload } from '@/composables/useStaffEvent'
import { orderDraftInvoice } from '@/lib/orderInvoices'

const emptyFilters = () => ({
  number: '',
  statuses: [] as string[],
  department_id: [] as number[],
  created_by: [] as number[],
  created_from: '',
  created_to: '',
  due_from: '',
  due_to: '',
  cancelled_from: '',
  cancelled_to: '',
  completed_from: '',
  completed_to: '',
  client_name: '',
  client_phone: '',
  technician_id: [] as number[],
  payment_status: [] as string[],
  has_invoice: 'all' as 'all' | '1' | '0',
})

function queryValues(value: unknown): string[] {
  if (value == null || value === '') return []
  const raw = Array.isArray(value) ? value : String(value).split(',')
  return raw.map((item) => String(item).trim()).filter(Boolean)
}

function queryInts(value: unknown): number[] {
  return queryValues(value).map(Number).filter((n) => Number.isInteger(n) && n > 0)
}

function queryDate(value: unknown): string {
  const raw = queryValues(value)[0] || ''
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : ''
}

function filtersFromQuery(query: Record<string, unknown>) {
  const next = emptyFilters()
  next.statuses = queryValues(query.status)
  next.department_id = queryInts(query.department_id)
  next.technician_id = queryInts(query.technician_id)
  next.completed_from = queryDate(query.completed_from)
  next.completed_to = queryDate(query.completed_to)
  next.cancelled_from = queryDate(query.cancelled_from)
  next.cancelled_to = queryDate(query.cancelled_to)
  return next
}

const { t } = useI18n()
const auth = useAuthStore()
const modals = useModalsStore()
const statuses = useStatusStore()
const inbox = useInboxStore()
const { orderUnread } = storeToRefs(inbox)
const route = useRoute()
const router = useRouter()
const departments = ref<any[]>([])
const orders = ref<any[]>([])
const creators = ref<{ id: number; name_en: string; name_ar: string }[]>([])
const technicians = ref<{ id: number; name_en: string; name_ar: string }[]>([])
const filters = ref(filtersFromQuery(route.query))
const editOpen = ref(false)
const confirmOpen = ref(false)
const invoiceOpen = ref(false)
const invoiceOrderId = ref<number | null>(null)
const invoiceDocId = ref<number | null>(null)
const error = ref('')
const editing = ref<any>(null)
const editForm = ref({ notes: '', department_id: '', location_id: '', contract_id: '', planned_date: '' })
const loading = ref(true)
const saving = ref(false)
const confirming = ref(false)
const threadId = ref<number | null>(null)
const threadHost = ref<{ openComments: () => void; openFiles: () => void } | null>(null)

const paymentOptions = computed(() => [
  { value: 'unpaid', label: t('orders.paymentUnpaid') },
  { value: 'partial', label: t('orders.paymentPartial') },
  { value: 'paid', label: t('orders.paymentPaid') },
])

const statusOptions = computed(() =>
  statuses.items.map((row) => ({ value: row.slug, label: statuses.label(row.slug) })),
)

const creatorOptions = computed(() =>
  creators.value.map((row) => ({ value: row.id, label: personName(row) })),
)

const technicianOptions = computed(() =>
  technicians.value.map((row) => ({ value: row.id, label: personName(row) })),
)

const invoiceOptions = computed(() => [
  { value: 'all', label: t('common.all') },
  { value: '1', label: t('common.yes') },
  { value: '0', label: t('common.no') },
])

const departmentOptions = computed(() =>
  departments.value.map((row) => ({ value: row.id, label: departmentName(row) })),
)

const hasFilters = computed(() => {
  const f = filters.value
  return Boolean(
    f.number
    || f.statuses.length
    || f.department_id.length
    || f.created_by.length
    || f.created_from
    || f.created_to
    || f.due_from
    || f.due_to
    || f.cancelled_from
    || f.cancelled_to
    || f.completed_from
    || f.completed_to
    || f.client_name
    || f.client_phone
    || f.technician_id.length
    || f.payment_status.length
    || f.has_invoice !== 'all',
  )
})

function filterParams() {
  const f = filters.value
  return {
    number: f.number || undefined,
    status: f.statuses.length ? f.statuses : undefined,
    department_id: f.department_id.length ? f.department_id : undefined,
    created_by: f.created_by.length ? f.created_by : undefined,
    created_from: f.created_from || undefined,
    created_to: f.created_to || undefined,
    due_from: f.due_from || undefined,
    due_to: f.due_to || undefined,
    cancelled_from: f.cancelled_from || undefined,
    cancelled_to: f.cancelled_to || undefined,
    completed_from: f.completed_from || undefined,
    completed_to: f.completed_to || undefined,
    client_name: f.client_name || undefined,
    client_phone: f.client_phone || undefined,
    technician_id: f.technician_id.length ? f.technician_id : undefined,
    payment_status: f.payment_status.length ? f.payment_status : undefined,
    has_invoice: f.has_invoice === 'all' ? undefined : f.has_invoice,
  }
}

async function loadDepartments() {
  departments.value = (await api.get('/api/departments', { params: { is_service: 1 } })).data
}

async function loadOptions() {
  const { data } = await api.get('/api/orders/filter-options')
  creators.value = data.creators || []
  technicians.value = data.technicians || []
}

async function load() {
  loading.value = true
  try {
    orders.value = (await api.get('/api/orders', { params: filterParams() })).data
  } finally {
    loading.value = false
  }
}

const searchNow = useDebounceFn(load, 250)
watch(filters, searchNow, { deep: true })

function clearFilters() {
  filters.value = emptyFilters()
}

onMounted(async () => {
  await Promise.all([loadDepartments(), loadOptions(), load()])
  const clientId = Number(route.query.client)
  if (clientId && auth.can('orders.create')) {
    await modals.createOrderForClient(clientId)
  }
  openConvoFromRoute()
})

watch(() => [route.query.order, route.query.id, route.hash], openConvoFromRoute)

watch(
  () => [
    route.query.status,
    route.query.department_id,
    route.query.technician_id,
    route.query.completed_from,
    route.query.completed_to,
    route.query.cancelled_from,
    route.query.cancelled_to,
  ],
  () => {
    filters.value = filtersFromQuery(route.query)
  },
)

watch(() => modals.savedAt, () => {
  if (modals.savedKind === 'order') {
    void loadOptions()
    void load()
  }
})

useStaffReload((e) => e.kind === 'order', () => {
  void loadOptions()
  void load()
})

async function openEdit(order: any) {
  error.value = ''
  editing.value = order
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  editForm.value = {
    notes: order.notes || '',
    department_id: String(order.department_id || order.department?.id || ''),
    location_id: String(order.location_id || order.location?.id || ''),
    contract_id: order.contract_id ? String(order.contract_id) : '',
    planned_date: String(order.planned_date || '').slice(0, 10) || today,
  }
  editOpen.value = true
}

async function saveOrder() {
  if (saving.value) return
  error.value = ''
  saving.value = true
  try {
    await api.put(`/api/orders/${editing.value.id}`, {
      notes: editForm.value.notes,
      department_id: Number(editForm.value.department_id),
      location_id: Number(editForm.value.location_id),
      contract_id: editForm.value.contract_id ? Number(editForm.value.contract_id) : null,
      planned_date: editForm.value.planned_date || null,
    })
    editOpen.value = false
    await load()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}

function canManageInvoice(order: any) {
  if (order.status === 'completed' || order.status === 'cancelled') return false
  if (orderDraftInvoice(order)) return auth.canAny('invoices.update', 'invoices.confirm', 'invoices.create')
  return auth.can('invoices.create')
}

function openInvoice(order: any) {
  invoiceOrderId.value = order.id
  invoiceDocId.value = orderDraftInvoice(order)?.id ?? null
  invoiceOpen.value = true
}

function askDelete(order: any) {
  editing.value = order
  confirmOpen.value = true
}

function rowActions(order: any) {
  const unread = orderUnread.value[order.id]
  return [
    {
      id: 'comments',
      label: unread ? `${t('comments.title')} (${unread})` : t('comments.title'),
    },
    { id: 'files', label: t('comments.files') },
    {
      id: 'invoice',
      label: orderDraftInvoice(order) ? t('dispatch.invoiceTitle') : t('tech.createInvoice'),
      show: canManageInvoice(order),
    },
    {
      id: 'edit',
      label: t('common.edit'),
      show: auth.can('orders.update') && order.status !== 'completed' && order.status !== 'cancelled',
    },
    {
      id: 'delete',
      label: t('common.delete'),
      danger: true,
      show: auth.can('orders.delete') && order.status === 'pending',
    },
  ]
}

function onRowAction(order: any, id: string) {
  if (id === 'comments') void openConvo(order.id, 'comments')
  if (id === 'files') void openConvo(order.id, 'files')
  if (id === 'invoice') openInvoice(order)
  if (id === 'edit') void openEdit(order)
  if (id === 'delete') askDelete(order)
}

function openRow(order: any) {
  void router.push(`/orders/${order.id}`)
}

async function openConvo(orderId: number, pane: 'comments' | 'files') {
  threadId.value = orderId
  await nextTick()
  if (pane === 'files') threadHost.value?.openFiles()
  else threadHost.value?.openComments()
}

function openConvoFromRoute() {
  const id = Number(route.query.order) || Number(route.query.id)
  if (!id) return
  if (route.hash === '#files') void openConvo(id, 'files')
  else if (route.hash === '#comments') void openConvo(id, 'comments')
}

async function deleteOrder() {
  if (confirming.value) return
  error.value = ''
  confirming.value = true
  try {
    await api.delete(`/api/orders/${editing.value.id}`)
    confirmOpen.value = false
    await load()
  } catch (e) {
    error.value = apiError(e)
    confirmOpen.value = false
  } finally {
    confirming.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader :title="t('orders.title')" :subtitle="t('orders.subtitle')">
      <template #actions>
        <Button v-if="auth.can('orders.create')" @click="modals.createOrder()">
          <Plus class="size-4" /> {{ t('orders.place') }}
        </Button>
      </template>
    </PageHeader>

    <Card class="mb-4 p-3">
      <div class="flex flex-wrap items-start gap-x-6 gap-y-3">
        <FilterGroup :label="t('common.client')">
          <Input v-model="filters.client_name" class="h-8 w-40" :placeholder="t('orders.clientName')" />
          <Input v-model="filters.client_phone" class="h-8 w-36" :placeholder="t('orders.clientPhone')" inputmode="tel" />
        </FilterGroup>
        <FilterGroup :label="t('orders.groupOrder')">
          <Input v-model="filters.number" class="h-8 w-28" :placeholder="t('orders.orderNumber')" inputmode="numeric" />
          <FilterMulti v-model="filters.statuses" :label="t('common.status')" :options="statusOptions" />
          <FilterMulti v-model="filters.department_id" :label="t('common.department')" :options="departmentOptions" />
        </FilterGroup>
        <FilterGroup :label="t('orders.groupStaff')">
          <FilterMulti v-model="filters.created_by" :label="t('orders.creator')" :options="creatorOptions" />
          <FilterMulti v-model="filters.technician_id" :label="t('common.technician')" :options="technicianOptions" />
        </FilterGroup>
        <FilterGroup :label="t('orders.groupBilling')">
          <FilterMulti v-model="filters.payment_status" :label="t('orders.paymentStatus')" :options="paymentOptions" />
          <FilterSelect v-model="filters.has_invoice" :label="t('orders.hasInvoice')" :options="invoiceOptions" />
        </FilterGroup>
        <FilterGroup :label="t('orders.groupDates')">
          <FilterDateRange v-model:from="filters.created_from" v-model:to="filters.created_to" :label="t('orders.createdDate')" />
          <FilterDateRange v-model:from="filters.due_from" v-model:to="filters.due_to" :label="t('orders.dueDate')" />
          <FilterDateRange v-model:from="filters.cancelled_from" v-model:to="filters.cancelled_to" :label="t('orders.cancelledDate')" />
          <FilterDateRange v-model:from="filters.completed_from" v-model:to="filters.completed_to" :label="t('orders.completedDate')" />
        </FilterGroup>
        <div v-if="hasFilters" class="flex items-end self-end">
          <Button type="button" variant="ghost" size="sm" class="h-8" @click="clearFilters">
            <X class="size-3.5" /> {{ t('orders.clearFilters') }}
          </Button>
        </div>
      </div>
    </Card>

    <div class="relative">
      <LoadingState v-if="loading && !orders.length" />
      <div v-else-if="orders.length" class="space-y-3">
        <OrderDetailsCard
          v-for="o in orders"
          :key="o.id"
          :order="o"
          show-id
          class="cursor-pointer transition-colors hover:border-slate-300 dark:hover:border-slate-500"
          @click="openRow(o)"
        >
          <template #actions>
            <div @click.stop>
              <ActionMenu
                :items="rowActions(o)"
                :badge="orderUnread[o.id]"
                @select="onRowAction(o, $event)"
              />
            </div>
          </template>
        </OrderDetailsCard>
      </div>
      <div v-else class="panel">
        <EmptyState
          :title="hasFilters ? t('common.noResults') : t('orders.emptyTitle')"
          :description="hasFilters ? undefined : t('orders.emptyHint')"
        >
          <template #icon><ClipboardList class="size-5" /></template>
          <template v-if="auth.can('orders.create') && !hasFilters" #action>
            <Button @click="modals.createOrder()">
              <Plus class="size-4" /> {{ t('orders.place') }}
            </Button>
          </template>
        </EmptyState>
      </div>
      <LoadingState v-if="loading && orders.length" overlay />
    </div>

    <FormDialog v-model:open="editOpen" :title="t('orders.editTitle')" :submit-label="t('orders.saveOrder')" :error="error" :loading="saving" @submit="saveOrder">
      <Field :label="t('common.department')">
        <select v-model="editForm.department_id" class="select" required>
          <option v-for="d in departments" :key="d.id" :value="d.id">{{ departmentName(d) }}</option>
        </select>
      </Field>
      <Field :label="t('contracts.plannedDate')">
        <Input v-model="editForm.planned_date" type="date" required />
      </Field>
      <Field :label="t('common.notes')"><Input v-model="editForm.notes" /></Field>
    </FormDialog>

    <InvoiceDraftDialog
      v-model:open="invoiceOpen"
      :order-id="invoiceOrderId"
      :invoice-id="invoiceDocId"
      @saved="load"
    />

    <ConversationActions
      v-if="threadId"
      ref="threadHost"
      type="order"
      :id="threadId"
      hide-buttons
      :follow-hash="false"
    />

    <ConfirmDialog
      v-model:open="confirmOpen"
      :title="t('orders.deleteTitle')"
      :description="t('orders.deleteDesc')"
      :confirm-label="t('common.delete')"
      variant="destructive"
      :loading="confirming"
      @confirm="deleteOrder"
    />
  </div>
</template>
