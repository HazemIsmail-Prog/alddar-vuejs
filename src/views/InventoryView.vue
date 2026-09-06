<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Pencil, Plus } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import { apiError } from '@/lib/utils'
import { named, personName, departmentName } from '@/i18n'
import { Button } from '@/components/ui/button'
import DeleteButton from '@/components/DeleteButton.vue'
import { Input } from '@/components/ui/input'
import Field from '@/components/ui/Field.vue'
import FormDialog from '@/components/FormDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import PageHeader from '@/components/PageHeader.vue'
import ActionMenu from '@/components/ActionMenu.vue'
import ConversationActions from '@/components/ConversationActions.vue'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
const items = ref<any[]>([])
const departments = ref<any[]>([])
const route = useRoute()
const warehouses = ref<any[]>([])
const staff = ref<any[]>([])
const stockLevels = ref<any[]>([])
const transfers = ref<any[]>([])
const adjustments = ref<any[]>([])
const tab = ref<'stock' | 'warehouses' | 'items' | 'services' | 'transfers' | 'adjustments'>('stock')
const canSeeWarehouses = computed(() =>
  auth.canAny('inventory.view', 'inventory.view_own', 'items.view', 'transfers.view', 'adjustments.view', 'inventory.receive', 'warehouses.create'),
)
const inventoryTabs = computed(() => {
  const list: { id: typeof tab.value; labelKey: string }[] = []
  if (auth.can('inventory.view')) list.push({ id: 'stock', labelKey: 'inventory.stock' })
  if (canSeeWarehouses.value) list.push({ id: 'warehouses', labelKey: 'inventory.warehouses' })
  if (auth.can('items.view')) {
    list.push({ id: 'items', labelKey: 'inventory.items' })
    list.push({ id: 'services', labelKey: 'inventory.services' })
  }
  if (auth.can('transfers.view')) list.push({ id: 'transfers', labelKey: 'inventory.transfers' })
  if (auth.can('adjustments.view')) list.push({ id: 'adjustments', labelKey: 'inventory.adjustments' })
  return list
})
const stockWarehouseId = ref('')
const stockSearch = ref('')
const includeZero = ref(false)
const error = ref('')
const itemOpen = ref(false)
const warehouseOpen = ref(false)
const receiptOpen = ref(false)
const transferOpen = ref(false)
const adjOpen = ref(false)
const detailOpen = ref(false)
const detailKind = ref<'transfer' | 'adjustment'>('transfer')
const detail = ref<any>(null)
const confirmOpen = ref(false)
const confirmTitle = ref('')
const confirmDescription = ref('')
const confirmLabel = ref('')
const confirmVariant = ref<'default' | 'destructive'>('default')
const confirmAction = ref<null | (() => Promise<void>)>(null)
const saving = ref(false)
const confirming = ref(false)

const itemForm = ref({ sku: '', name: '', type: 'tracked_part', valuation_method: 'weighted_average', cost: '0', default_price: '0', is_sellable: true, department_id: '' })
const warehouseForm = ref({ name: '', type: 'central', technician_id: '' })
const editingItemId = ref<number | null>(null)
const editingWarehouseId = ref<number | null>(null)
const editingTransferId = ref<number | null>(null)
const editingAdjId = ref<number | null>(null)
const receipt = ref({ warehouse_id: '', item_id: '', qty: '1', unit_cost: '0' })
const transfer = ref({
  from_warehouse_id: '',
  to_warehouse_id: '',
  lines: [{ item_id: '', qty: '1' }],
})
const adjustment = ref({
  warehouse_id: '',
  direction: 'decrease' as 'increase' | 'decrease',
  cause: 'lost',
  notes: '',
  lines: [{ item_id: '', qty: '1', unit_cost: '0' }],
})

const adjCauses = [
  { id: 'lost', label: 'Lost' },
  { id: 'expired', label: 'Expired' },
  { id: 'deprecated', label: 'Deprecated' },
  { id: 'damaged', label: 'Damaged' },
  { id: 'found', label: 'Found stock' },
  { id: 'cycle_count', label: 'Cycle count' },
  { id: 'other', label: 'Other' },
]

const adjCauseOptions = computed(() =>
  adjustment.value.direction === 'decrease'
    ? adjCauses.filter((c) => c.id !== 'found')
    : adjCauses.filter((c) => !['lost', 'expired', 'deprecated', 'damaged'].includes(c.id)),
)

const tracked = computed(() => items.value.filter((x) => x.type === 'tracked_part'))
const vanTechnicians = computed(() =>
  staff.value.filter((u) => {
    if (!(u.roles || []).some((r: any) => r.slug === 'technician')) return false
    if (!u.warehouse) return true
    return editingWarehouseId.value != null && u.warehouse.id === editingWarehouseId.value
  }),
)
function catalogType() {
  return tab.value === 'services' ? 'service' : 'tracked_part'
}

function matchesCatalogQuery(row: any, q: string) {
  return `${row.sku} ${row.name} ${departmentName(row.department)} ${row.department?.name_en || ''} ${row.department?.name_ar || ''}`.toLowerCase().includes(q)
}

const visibleItems = computed(() => {
  const type = catalogType()
  const q = stockSearch.value.trim().toLowerCase()
  return items.value.filter((row) => {
    if (row.type !== type) return false
    return !q || matchesCatalogQuery(row, q)
  })
})

const catalogIsService = computed(() => itemForm.value.type === 'service')

const filteredStock = computed(() => {
  const q = stockSearch.value.trim().toLowerCase()
  return stockLevels.value.filter((row) => {
    if (stockWarehouseId.value && String(row.warehouse_id) !== String(stockWarehouseId.value)) return false
    if (q && !`${row.sku} ${row.item} ${row.warehouse}`.toLowerCase().includes(q)) return false
    return true
  })
})

const stockValue = computed(() =>
  filteredStock.value.reduce((sum, row) => sum + Number(row.value || 0), 0),
)

function warehouseSkuCount(warehouseId: number) {
  return stockLevels.value.filter((row) => row.warehouse_id === warehouseId && Number(row.qty) > 0).length
}

function warehouseValue(warehouseId: number) {
  return stockLevels.value
    .filter((row) => row.warehouse_id === warehouseId)
    .reduce((sum, row) => sum + Number(row.value || 0), 0)
}

function showWarehouseStock(warehouse: { id: number }) {
  stockWarehouseId.value = String(warehouse.id)
  tab.value = 'stock'
}

function itemOnHand(itemId: number) {
  return stockLevels.value
    .filter((row) => row.item_id === itemId)
    .reduce((sum, row) => sum + Number(row.qty), 0)
}

function fmtQty(n: number | string) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function fmtWhen(iso?: string) {
  if (!iso) return '—'
  return iso.replace('T', ' ').slice(0, 16)
}

function lineSummary(lines: any[] | undefined, qtyKey: string) {
  if (!lines?.length) return '—'
  return lines.map((l) => `${l.item?.sku || l.item_id} ${signedQty(l[qtyKey])}`).join(', ')
}

function signedQty(n: number | string) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  if (v === 0) return '0'
  return `${v > 0 ? '+' : '-'}${fmtQty(Math.abs(v))}`
}

function blankAdjLine() {
  return { item_id: '', qty: '1', unit_cost: '0' }
}

function formatAdjReason(cause: string, notes: string) {
  const label = adjCauses.find((c) => c.id === cause)?.label ?? 'Other'
  const extra = notes.trim()
  return extra ? `${label}: ${extra}` : label
}

function parseAdjReason(reason: string) {
  const text = (reason || '').trim()
  for (const cause of adjCauses) {
    if (text === cause.label) return { cause: cause.id, notes: '' }
    if (text.startsWith(`${cause.label}: `)) return { cause: cause.id, notes: text.slice(cause.label.length + 2) }
  }
  return { cause: 'other', notes: text }
}

function adjActionLabel(row: any) {
  const deltas = (row?.lines || []).map((line: any) => Number(line.qty_delta))
  if (!deltas.length) return t('common.dash')
  if (deltas.every((d: number) => d < 0)) return t('inventory.decrease')
  if (deltas.every((d: number) => d > 0)) return t('inventory.increase')
  return t('inventory.mixed')
}

function isTechnicianWarehouse(wh: any) {
  return wh?.type === 'technician' || !!wh?.technician_id
}

function canReceiveTransfer(xfer: any) {
  if (xfer.status !== 'in_transit' || !auth.can('transfers.receive')) return false
  const dest = xfer.to_warehouse
  if (isTechnicianWarehouse(dest)) {
    return Number(dest.technician_id) === Number(auth.user?.id)
  }
  return true
}

function showTransfer(row: any) {
  detailKind.value = 'transfer'
  detail.value = row
  detailOpen.value = true
}

function showAdjustment(row: any) {
  detailKind.value = 'adjustment'
  detail.value = row
  detailOpen.value = true
}

async function loadStock() {
  if (!auth.can('inventory.view')) {
    stockLevels.value = []
    return
  }
  stockLevels.value = (
    await api.get('/api/stock-levels', { params: { include_zero: includeZero.value ? 1 : 0 } })
  ).data
}

async function load() {
  if (auth.can('items.view')) {
    items.value = (await api.get('/api/items')).data
    try {
      departments.value = (await api.get('/api/departments', { params: { is_service: 1 } })).data
    } catch {
      departments.value = []
    }
  }
  if (canSeeWarehouses.value) {
    warehouses.value = (await api.get('/api/warehouses')).data
  }
  if (auth.can('users.view')) {
    try {
      staff.value = (await api.get('/api/users')).data
    } catch {
      staff.value = []
    }
  }
  await loadStock()
  if (auth.can('transfers.view')) {
    try {
      transfers.value = (await api.get('/api/transfers')).data
    } catch {
      transfers.value = []
    }
  }
  if (auth.can('adjustments.view')) {
    try {
      adjustments.value = (await api.get('/api/adjustments')).data
    } catch {
      adjustments.value = []
    }
  }
  if (detail.value) {
    const list = detailKind.value === 'transfer' ? transfers.value : adjustments.value
    detail.value = list.find((row: any) => row.id === detail.value.id) ?? detail.value
  }
}

watch(includeZero, loadStock)

function startWarehouse() {
  editingWarehouseId.value = null
  warehouseForm.value = { name: '', type: 'central', technician_id: '' }
  error.value = ''
  warehouseOpen.value = true
}

function startEditWarehouse(row: any) {
  editingWarehouseId.value = row.id
  warehouseForm.value = {
    name: row.name,
    type: row.type === 'technician' ? 'technician' : 'central',
    technician_id: row.technician_id ? String(row.technician_id) : '',
  }
  error.value = ''
  warehouseOpen.value = true
}

async function saveWarehouse() {
  if (saving.value) return
  error.value = ''
  if (warehouseForm.value.type === 'technician' && !warehouseForm.value.technician_id) {
    error.value = t('inventory.needTech')
    return
  }
  saving.value = true
  try {
    const payload = {
      name: warehouseForm.value.name.trim(),
      type: warehouseForm.value.type,
      technician_id: warehouseForm.value.type === 'technician' ? Number(warehouseForm.value.technician_id) : null,
    }
    if (editingWarehouseId.value) {
      await api.put(`/api/warehouses/${editingWarehouseId.value}`, payload)
    } else {
      await api.post('/api/warehouses', payload)
    }
    warehouseOpen.value = false
    tab.value = 'warehouses'
    await load()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}

function startItem() {
  editingItemId.value = null
  itemForm.value = { sku: '', name: '', type: catalogType(), valuation_method: 'weighted_average', cost: '0', default_price: '0', is_sellable: true, department_id: '' }
  error.value = ''
  itemOpen.value = true
}

function startEditItem(item: any) {
  editingItemId.value = item.id
  itemForm.value = {
    sku: item.sku,
    name: item.name,
    type: item.type,
    valuation_method: item.valuation_method || 'weighted_average',
    cost: String(item.cost ?? '0'),
    default_price: String(item.default_price ?? '0'),
    is_sellable: item.is_sellable !== false,
    department_id: item.department_id ? String(item.department_id) : '',
  }
  error.value = ''
  itemOpen.value = true
}

async function saveItem() {
  if (saving.value) return
  error.value = ''
  saving.value = true
  try {
    const payload = {
      ...itemForm.value,
      cost: Number(itemForm.value.cost),
      default_price: itemForm.value.is_sellable ? Number(itemForm.value.default_price) : 0,
      is_sellable: itemForm.value.is_sellable,
      valuation_method: itemForm.value.type === 'tracked_part' ? itemForm.value.valuation_method : null,
      department_id: itemForm.value.department_id ? Number(itemForm.value.department_id) : null,
    }
    if (editingItemId.value) {
      await api.put(`/api/items/${editingItemId.value}`, payload)
    } else {
      await api.post('/api/items', payload)
    }
    itemOpen.value = false
    await load()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}

async function doReceipt() {
  if (saving.value) return
  error.value = ''
  saving.value = true
  try {
    await api.post(`/api/warehouses/${receipt.value.warehouse_id}/receipts`, {
      item_id: Number(receipt.value.item_id),
      qty: Number(receipt.value.qty),
      unit_cost: Number(receipt.value.unit_cost),
    })
    receiptOpen.value = false
    tab.value = 'stock'
    await load()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}

async function saveTransfer() {
  if (saving.value) return
  error.value = ''
  const lines = transfer.value.lines
    .filter((line) => line.item_id && Number(line.qty) > 0)
    .map((line) => ({ item_id: Number(line.item_id), qty: Number(line.qty) }))
  if (!lines.length) {
    error.value = t('inventory.needItem')
    return
  }
  const payload = {
    from_warehouse_id: Number(transfer.value.from_warehouse_id),
    to_warehouse_id: Number(transfer.value.to_warehouse_id),
    lines,
  }
  saving.value = true
  try {
    if (editingTransferId.value) {
      await api.put(`/api/transfers/${editingTransferId.value}`, payload)
    } else {
      await api.post('/api/transfers', payload)
    }
    transferOpen.value = false
    tab.value = 'transfers'
    await load()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}

async function saveAdj() {
  if (saving.value) return
  error.value = ''
  const lines = adjustment.value.lines
    .filter((line) => line.item_id && Number(line.qty) > 0)
    .map((line) => {
      const qty = Math.abs(Number(line.qty))
      const qty_delta = adjustment.value.direction === 'decrease' ? -qty : qty
      return {
        item_id: Number(line.item_id),
        qty_delta,
        unit_cost: adjustment.value.direction === 'increase' ? Number(line.unit_cost) : null,
      }
    })
  if (!lines.length) {
    error.value = t('inventory.needItem')
    return
  }
  const payload = {
    warehouse_id: Number(adjustment.value.warehouse_id),
    reason: formatAdjReason(adjustment.value.cause, adjustment.value.notes),
    lines,
  }
  saving.value = true
  try {
    if (editingAdjId.value) {
      await api.put(`/api/adjustments/${editingAdjId.value}`, payload)
    } else {
      await api.post('/api/adjustments', payload)
    }
    adjOpen.value = false
    tab.value = 'adjustments'
    await load()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}

function startTransfer() {
  editingTransferId.value = null
  transfer.value = {
    from_warehouse_id: '',
    to_warehouse_id: '',
    lines: [{ item_id: '', qty: '1' }],
  }
  error.value = ''
  transferOpen.value = true
}

function startEditTransfer(row: any) {
  editingTransferId.value = row.id
  transfer.value = {
    from_warehouse_id: String(row.from_warehouse_id),
    to_warehouse_id: String(row.to_warehouse_id),
    lines: (row.lines || []).map((line: any) => ({
      item_id: String(line.item_id),
      qty: String(line.qty ?? '1'),
    })),
  }
  if (!transfer.value.lines.length) {
    transfer.value.lines = [{ item_id: '', qty: '1' }]
  }
  error.value = ''
  transferOpen.value = true
}

function startAdj() {
  editingAdjId.value = null
  adjustment.value = {
    warehouse_id: '',
    direction: 'decrease',
    cause: 'lost',
    notes: '',
    lines: [blankAdjLine()],
  }
  error.value = ''
  adjOpen.value = true
}

function startEditAdj(row: any) {
  editingAdjId.value = row.id
  const parsed = parseAdjReason(row.reason || '')
  const deltas = (row.lines || []).map((line: any) => Number(line.qty_delta))
  const direction = deltas.some((d: number) => d < 0) && !deltas.some((d: number) => d > 0) ? 'decrease'
    : deltas.some((d: number) => d > 0) && !deltas.some((d: number) => d < 0) ? 'increase'
    : deltas.filter((d: number) => d < 0).length >= deltas.filter((d: number) => d > 0).length ? 'decrease'
    : 'increase'
  adjustment.value = {
    warehouse_id: String(row.warehouse_id),
    direction,
    cause: parsed.cause,
    notes: parsed.notes,
    lines: (row.lines || []).map((line: any) => ({
      item_id: String(line.item_id),
      qty: String(Math.abs(Number(line.qty_delta)) || 1),
      unit_cost: String(line.unit_cost ?? '0'),
    })),
  }
  if (!adjustment.value.lines.length) {
    adjustment.value.lines = [blankAdjLine()]
  }
  onAdjDirectionChange()
  error.value = ''
  adjOpen.value = true
}

function onAdjDirectionChange() {
  const allowed = adjCauseOptions.value.map((c) => c.id)
  if (!allowed.includes(adjustment.value.cause)) {
    adjustment.value.cause = adjustment.value.direction === 'decrease' ? 'lost' : 'found'
  }
}

function addTransferLine() {
  transfer.value.lines.push({ item_id: '', qty: '1' })
}

function removeTransferLine(index: number) {
  if (transfer.value.lines.length === 1) return
  transfer.value.lines.splice(index, 1)
}

function addAdjLine() {
  adjustment.value.lines.push(blankAdjLine())
}

function removeAdjLine(index: number) {
  if (adjustment.value.lines.length === 1) return
  adjustment.value.lines.splice(index, 1)
}

function trackedOptions(currentId: string, lines: { item_id: string }[]) {
  const used = lines.map((line) => String(line.item_id)).filter(Boolean)
  return tracked.value.filter((item) => String(item.id) === currentId || !used.includes(String(item.id)))
}

function ask(title: string, label: string, variant: 'default' | 'destructive', fn: () => Promise<void>) {
  confirmTitle.value = title
  confirmDescription.value = ''
  confirmLabel.value = label
  confirmVariant.value = variant
  confirmAction.value = fn
  confirmOpen.value = true
}

async function runConfirm() {
  if (!confirmAction.value || confirming.value) return
  confirming.value = true
  try {
    await confirmAction.value()
    confirmOpen.value = false
    await load()
  } catch (e) {
    confirmDescription.value = apiError(e)
  } finally {
    confirming.value = false
  }
}

onMounted(async () => {
  const tabQuery = route.query.tab
  if (tabQuery === 'items' || tabQuery === 'services' || tabQuery === 'stock' || tabQuery === 'warehouses' || tabQuery === 'transfers' || tabQuery === 'adjustments') {
    tab.value = tabQuery
  }
  if (!inventoryTabs.value.some((item) => item.id === tab.value) && inventoryTabs.value[0]) {
    tab.value = inventoryTabs.value[0].id
  }
  if (typeof route.query.q === 'string') stockSearch.value = route.query.q
  await load()
  const q = stockSearch.value.trim().toLowerCase()
  if (q && (tab.value === 'items' || tab.value === 'services')) {
    const matchItem = items.value.some((row) => row.type === 'tracked_part' && matchesCatalogQuery(row, q))
    const matchService = items.value.some((row) => row.type === 'service' && matchesCatalogQuery(row, q))
    if (tab.value === 'items' && !matchItem && matchService) tab.value = 'services'
    if (tab.value === 'services' && !matchService && matchItem) tab.value = 'items'
  }
  const id = Number(route.query.id)
  if (!id) return
  if (tab.value === 'transfers') {
    const row = transfers.value.find((item: any) => item.id === id)
    if (row) showTransfer(row)
  } else if (tab.value === 'adjustments') {
    const row = adjustments.value.find((item: any) => item.id === id)
    if (row) showAdjustment(row)
  } else if (tab.value === 'items' || tab.value === 'services') {
    const row = items.value.find((item: any) => item.id === id)
    if (row) {
      tab.value = row.type === 'service' ? 'services' : 'items'
      startEditItem(row)
    }
  }
})
</script>

<template>
  <div>
    <PageHeader :title="t('inventory.title')" :subtitle="t('inventory.subtitle')">
      <template #actions>
        <Button v-if="tab === 'warehouses' && auth.can('warehouses.create')" @click="startWarehouse">
          <Plus class="size-4" /> {{ t('inventory.newWarehouse') }}
        </Button>
        <Button v-else-if="auth.can('items.create')" @click="startItem">
          <Plus class="size-4" /> {{ tab === 'services' ? t('inventory.addService') : t('inventory.addItem') }}
        </Button>
        <ActionMenu
          :items="[
            { id: 'receive', label: t('inventory.receiveStock'), show: auth.can('inventory.receive') },
            { id: 'transfer', label: t('inventory.transfer'), show: auth.can('transfers.create') },
            { id: 'adjust', label: t('inventory.adjust'), show: auth.can('adjustments.create') },
          ]"
          :label="t('inventory.moreActions')"
          @select="(id) => {
            if (id === 'receive') receiptOpen = true
            if (id === 'transfer') startTransfer()
            if (id === 'adjust') startAdj()
          }"
        />
      </template>
    </PageHeader>

    <div class="page-tabs">
      <button
        v-for="tabItem in inventoryTabs"
        :key="tabItem.id"
        type="button"
        class="page-tab"
        :class="tab === tabItem.id && 'is-active'"
        @click="tab = tabItem.id"
      >
        {{ t(tabItem.labelKey) }}
      </button>
    </div>

    <div v-if="tab === 'stock'">
      <div class="mb-3 flex flex-wrap items-end gap-3">
        <Field :label="t('inventory.warehouse')">
          <select v-model="stockWarehouseId" class="select min-w-48">
            <option value="">{{ t('inventory.allWarehouses') }}</option>
            <option v-for="w in warehouses" :key="w.id" :value="String(w.id)">{{ w.name }}</option>
          </select>
        </Field>
        <Field :label="t('common.search')">
          <Input v-model="stockSearch" class="min-w-56" :placeholder="t('inventory.skuOrName')" />
        </Field>
        <label class="flex cursor-pointer items-center gap-2.5 pb-1 text-sm text-slate-600">
          <Switch v-model="includeZero" /> {{ t('inventory.includeZero') }}
        </label>
        <p class="ms-auto pb-1 text-sm text-slate-500">{{ t('inventory.value', { value: fmtQty(stockValue) }) }}</p>
      </div>
      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t('inventory.warehouse') }}</th>
              <th>{{ t('inventory.sku') }}</th>
              <th>{{ t('common.item') }}</th>
              <th class="text-end">{{ t('common.qty') }}</th>
              <th class="text-end">{{ t('inventory.avgCost') }}</th>
              <th class="text-end">{{ t('contracts.value') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredStock" :key="row.id">
              <td>
                {{ row.warehouse }}
                <span class="ms-1 text-xs text-slate-400">{{ named('warehouseType', row.warehouse_type) }}</span>
              </td>
              <td class="font-medium">{{ row.sku }}</td>
              <td>{{ row.item }}</td>
              <td class="text-end font-medium">{{ fmtQty(row.qty) }}</td>
              <td class="text-end">{{ fmtQty(row.average_cost) }}</td>
              <td class="text-end">{{ fmtQty(row.value) }}</td>
            </tr>
            <tr v-if="!filteredStock.length">
              <td colspan="6" class="text-slate-400">{{ t('inventory.emptyStock') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else-if="tab === 'warehouses'" class="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t('common.name') }}</th>
            <th>{{ t('common.type') }}</th>
            <th>{{ t('inventory.assignTech') }}</th>
            <th class="text-end">{{ t('inventory.skusOnHand') }}</th>
            <th class="text-end">{{ t('contracts.value') }}</th>
            <th class="text-end"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in warehouses" :key="w.id">
            <td class="font-medium">{{ w.name }}</td>
            <td><Badge variant="secondary">{{ named('warehouseType', w.type) }}</Badge></td>
            <td>{{ w.technician ? personName(w.technician) : t('common.dash') }}</td>
            <td class="text-end">{{ fmtQty(warehouseSkuCount(w.id)) }}</td>
            <td class="text-end">{{ fmtQty(warehouseValue(w.id)) }}</td>
            <td class="text-end whitespace-nowrap">
              <Button v-if="auth.can('inventory.view')" size="sm" variant="outline" class="me-1" @click="showWarehouseStock(w)">
                {{ t('inventory.viewStock') }}
              </Button>
              <Button v-if="auth.can('warehouses.update')" size="sm" variant="outline" class="me-1" @click="startEditWarehouse(w)">
                <Pencil class="size-3.5" /> {{ t('common.edit') }}
              </Button>
              <DeleteButton
                v-if="auth.can('warehouses.delete')"
                @click="ask(t('inventory.deleteWarehouse'), t('common.delete'), 'destructive', () => api.delete(`/api/warehouses/${w.id}`))"
              />
            </td>
          </tr>
          <tr v-if="!warehouses.length">
            <td colspan="6" class="text-slate-400">{{ t('inventory.emptyWarehouses') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="tab === 'items'" class="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t('inventory.sku') }}</th>
            <th>{{ t('common.name') }}</th>
            <th>{{ t('common.department') }}</th>
            <th class="text-end">{{ t('inventory.onHand') }}</th>
            <th>{{ t('inventory.valuation') }}</th>
            <th class="text-end">{{ t('inventory.price') }}</th>
            <th class="text-end"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in visibleItems" :key="i.id">
            <td class="font-medium">{{ i.sku }}</td>
            <td>{{ i.name }}</td>
            <td>{{ departmentName(i.department) }}</td>
            <td class="text-end">{{ fmtQty(itemOnHand(i.id)) }}</td>
            <td>{{ named('valuation', i.valuation_method) }}</td>
            <td class="text-end">{{ i.default_price }}</td>
            <td class="text-end whitespace-nowrap">
              <Button v-if="auth.can('items.update')" size="sm" variant="outline" @click="startEditItem(i)"><Pencil class="size-3.5" /> {{ t('common.edit') }}</Button>
              <DeleteButton v-if="auth.can('items.delete')" class="ms-1" @click="ask(t('inventory.deleteItem'), t('common.delete'), 'destructive', () => api.delete(`/api/items/${i.id}`))" />
            </td>
          </tr>
          <tr v-if="!visibleItems.length"><td colspan="7" class="text-slate-400">{{ t('inventory.emptyItems') }}</td></tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="tab === 'services'" class="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t('inventory.sku') }}</th>
            <th>{{ t('common.name') }}</th>
            <th>{{ t('common.department') }}</th>
            <th class="text-end">{{ t('inventory.price') }}</th>
            <th class="text-end"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in visibleItems" :key="i.id">
            <td class="font-medium">{{ i.sku }}</td>
            <td>{{ i.name }}</td>
            <td>{{ departmentName(i.department) }}</td>
            <td class="text-end">{{ i.default_price }}</td>
            <td class="text-end whitespace-nowrap">
              <Button v-if="auth.can('items.update')" size="sm" variant="outline" @click="startEditItem(i)"><Pencil class="size-3.5" /> {{ t('common.edit') }}</Button>
              <DeleteButton v-if="auth.can('items.delete')" class="ms-1" @click="ask(t('inventory.deleteService'), t('common.delete'), 'destructive', () => api.delete(`/api/items/${i.id}`))" />
            </td>
          </tr>
          <tr v-if="!visibleItems.length"><td colspan="5" class="text-slate-400">{{ t('inventory.emptyServices') }}</td></tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="tab === 'transfers'" class="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t('orders.id') }}</th>
            <th>{{ t('inventory.from') }}</th>
            <th>{{ t('inventory.to') }}</th>
            <th>{{ t('inventory.items') }}</th>
            <th>{{ t('common.status') }}</th>
            <th class="text-end"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="xfer in transfers" :key="xfer.id">
            <td class="font-medium">#{{ xfer.id }}</td>
            <td>{{ xfer.from_warehouse?.name }}</td>
            <td>{{ xfer.to_warehouse?.name }}</td>
            <td class="max-w-xs truncate" :title="lineSummary(xfer.lines, 'qty')">{{ lineSummary(xfer.lines, 'qty') }}</td>
            <td><Badge variant="secondary">{{ named('transferStatus', xfer.status) }}</Badge></td>
            <td class="text-end whitespace-nowrap">
              <Button size="sm" variant="outline" class="me-1" @click="showTransfer(xfer)">{{ t('common.details') }}</Button>
              <Button v-if="xfer.status === 'draft' && auth.can('transfers.update')" size="sm" variant="outline" class="me-1" @click="startEditTransfer(xfer)">
                <Pencil class="size-3.5" /> {{ t('common.edit') }}
              </Button>
              <DeleteButton
                v-if="xfer.status === 'draft' && auth.can('transfers.delete')"
                class="me-1"
                @click="ask(t('inventory.deleteTransfer'), t('common.delete'), 'destructive', () => api.delete(`/api/transfers/${xfer.id}`))"
              />
              <Button v-if="xfer.status === 'draft' && auth.can('transfers.send')" size="sm" @click="ask(t('inventory.sendTransfer'), t('inventory.send'), 'default', () => api.post(`/api/transfers/${xfer.id}/send`))">{{ t('inventory.send') }}</Button>
              <Button v-if="canReceiveTransfer(xfer)" size="sm" class="ms-1" @click="ask(t('inventory.receiveTransfer'), t('inventory.receive'), 'default', () => api.post(`/api/transfers/${xfer.id}/receive`))">{{ t('inventory.receive') }}</Button>
              <span v-else-if="xfer.status === 'in_transit' && isTechnicianWarehouse(xfer.to_warehouse)" class="ms-1 text-xs text-slate-400">{{ t('inventory.awaitingTechnician') }}</span>
              <Button v-if="xfer.status !== 'completed' && xfer.status !== 'cancelled' && auth.can('transfers.cancel')" size="sm" variant="outline" class="ms-1" @click="ask(t('inventory.cancelTransfer'), t('inventory.cancelTransferBtn'), 'destructive', () => api.post(`/api/transfers/${xfer.id}/cancel`))">{{ t('common.cancel') }}</Button>
            </td>
          </tr>
          <tr v-if="!transfers.length"><td colspan="6" class="text-slate-400">{{ t('inventory.emptyTransfers') }}</td></tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="tab === 'adjustments'" class="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t('orders.id') }}</th>
            <th>{{ t('inventory.warehouse') }}</th>
            <th>{{ t('inventory.items') }}</th>
            <th>{{ t('common.reason') }}</th>
            <th>{{ t('common.status') }}</th>
            <th class="text-end"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in adjustments" :key="a.id">
            <td class="font-medium">#{{ a.id }}</td>
            <td>{{ a.warehouse?.name }}</td>
            <td class="max-w-xs truncate" :title="lineSummary(a.lines, 'qty_delta')">{{ lineSummary(a.lines, 'qty_delta') }}</td>
            <td>{{ a.reason }}</td>
            <td><Badge variant="secondary">{{ named('adjustmentStatus', a.status) }}</Badge></td>
            <td class="text-end whitespace-nowrap">
              <Button size="sm" variant="outline" class="me-1" @click="showAdjustment(a)">{{ t('common.details') }}</Button>
              <Button v-if="a.status === 'draft' && auth.can('adjustments.update')" size="sm" variant="outline" class="me-1" @click="startEditAdj(a)">
                <Pencil class="size-3.5" /> Edit
              </Button>
              <DeleteButton
                v-if="a.status === 'draft' && auth.can('adjustments.delete')"
                class="me-1"
                @click="ask(t('inventory.deleteAdj'), t('common.delete'), 'destructive', () => api.delete(`/api/adjustments/${a.id}`))"
              />
              <Button v-if="a.status === 'draft' && auth.can('adjustments.post')" size="sm" @click="ask(t('inventory.postAdj'), t('inventory.post'), 'default', () => api.post(`/api/adjustments/${a.id}/post`))">{{ t('inventory.post') }}</Button>
            </td>
          </tr>
          <tr v-if="!adjustments.length"><td colspan="6" class="text-slate-400">{{ t('inventory.emptyAdjustments') }}</td></tr>
        </tbody>
      </table>
    </div>

    <FormDialog
      v-model:open="itemOpen"
      :title="editingItemId
        ? (catalogIsService ? t('inventory.editService') : t('inventory.editItem'))
        : (catalogIsService ? t('inventory.addServiceTitle') : t('inventory.addItemTitle'))"
      :submit-label="editingItemId
        ? (catalogIsService ? t('inventory.saveService') : t('inventory.saveItem'))
        : (catalogIsService ? t('inventory.createService') : t('inventory.createItem'))"
      :error="error"
      :loading="saving"
      @submit="saveItem"
    >
      <template #header-extra>
        <ConversationActions v-if="editingItemId" type="item" :id="editingItemId" class="mt-2" />
      </template>
      <div class="grid gap-3 sm:grid-cols-2">
        <Field :label="t('inventory.sku')"><Input v-model="itemForm.sku" required :disabled="!!editingItemId" /></Field>
        <Field :label="t('common.name')"><Input v-model="itemForm.name" required /></Field>
        <Field :label="t('common.department')">
          <select v-model="itemForm.department_id" class="select">
            <option value="">{{ t('contracts.none') }}</option>
            <option v-for="d in departments" :key="d.id" :value="String(d.id)">{{ departmentName(d) }}</option>
          </select>
        </Field>
        <Field v-if="itemForm.type === 'tracked_part'" :label="t('inventory.valuation')">
          <select v-model="itemForm.valuation_method" class="select">
            <option value="weighted_average">{{ t('inventory.weightedAverage') }}</option>
            <option value="fifo">{{ t('inventory.fifo') }}</option>
          </select>
        </Field>
        <Field :label="t('inventory.cost')"><Input v-model="itemForm.cost" type="number" min="0" step="1" /></Field>
        <Field v-if="itemForm.is_sellable" :label="t('inventory.defaultPrice')"><Input v-model="itemForm.default_price" type="number" min="0" step="1" /></Field>
        <label class="flex cursor-pointer items-center gap-2.5 text-sm sm:col-span-2">
          <Switch v-model="itemForm.is_sellable" /> {{ t('inventory.sellable') }}
        </label>
      </div>
    </FormDialog>

    <FormDialog
      v-model:open="warehouseOpen"
      :title="editingWarehouseId ? t('inventory.editWarehouse') : t('inventory.newWarehouse')"
      :description="t('inventory.warehouseDesc')"
      :submit-label="editingWarehouseId ? t('inventory.saveWarehouse') : t('inventory.createWarehouse')"
      :error="error"
      :loading="saving"
      @submit="saveWarehouse"
    >
      <Field :label="t('inventory.warehouseName')"><Input v-model="warehouseForm.name" required /></Field>
      <Field :label="t('common.type')">
        <select v-model="warehouseForm.type" class="select">
          <option value="central">{{ named('warehouseType', 'central') }}</option>
          <option v-if="vanTechnicians.length || warehouseForm.type === 'technician'" value="technician">{{ named('warehouseType', 'technician') }}</option>
        </select>
      </Field>
      <Field v-if="warehouseForm.type === 'technician'" :label="t('inventory.assignTech')">
        <select v-model="warehouseForm.technician_id" class="select" required>
          <option value="">{{ t('common.select') }}</option>
          <option v-for="u in vanTechnicians" :key="u.id" :value="String(u.id)">{{ personName(u) }}</option>
        </select>
      </Field>
    </FormDialog>

    <FormDialog v-model:open="receiptOpen" :title="t('inventory.receiveStock')" :description="t('inventory.receiveDesc')" :submit-label="t('inventory.receive')" :error="error" :loading="saving" @submit="doReceipt">
      <Field :label="t('inventory.warehouse')">
        <select v-model="receipt.warehouse_id" class="select" required>
          <option value="">{{ t('common.select') }}</option>
          <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
        </select>
      </Field>
      <Field :label="t('common.item')">
        <select v-model="receipt.item_id" class="select" required>
          <option value="">{{ t('common.select') }}</option>
          <option v-for="i in tracked" :key="i.id" :value="i.id">{{ i.sku }} — {{ i.name }}</option>
        </select>
      </Field>
      <div class="grid grid-cols-2 gap-3">
        <Field :label="t('common.qty')"><Input v-model="receipt.qty" type="number" min="0.01" step="0.01" required /></Field>
        <Field :label="t('inventory.unitCost')"><Input v-model="receipt.unit_cost" type="number" min="0" step="1" required /></Field>
      </div>
    </FormDialog>

    <FormDialog
      v-model:open="transferOpen"
      :title="editingTransferId ? t('inventory.editTransfer') : t('inventory.draftTransfer')"
      :description="t('inventory.transferDesc')"
      :submit-label="editingTransferId ? t('inventory.saveTransfer') : t('inventory.createDraft')"
      :error="error"
      wide
      :loading="saving"
      @submit="saveTransfer"
    >
      <div class="grid gap-3 sm:grid-cols-2">
        <Field :label="t('inventory.from')">
          <select v-model="transfer.from_warehouse_id" class="select" required>
            <option value="">{{ t('common.select') }}</option>
            <option v-for="w in warehouses" :key="w.id" :value="String(w.id)">{{ w.name }}</option>
          </select>
        </Field>
        <Field :label="t('inventory.to')">
          <select v-model="transfer.to_warehouse_id" class="select" required>
            <option value="">{{ t('common.select') }}</option>
            <option v-for="w in warehouses" :key="w.id" :value="String(w.id)">{{ w.name }}</option>
          </select>
        </Field>
      </div>
      <div v-for="(line, i) in transfer.lines" :key="i" class="grid grid-cols-[1fr_6rem_auto] items-end gap-2">
        <Field :label="t('common.item')">
          <select v-model="line.item_id" class="select" required>
            <option value="">{{ t('common.select') }}</option>
            <option v-for="item in trackedOptions(line.item_id, transfer.lines)" :key="item.id" :value="String(item.id)">
              {{ item.sku }} — {{ item.name }}
            </option>
          </select>
        </Field>
        <Field :label="t('common.qty')"><Input v-model="line.qty" type="number" min="0.01" step="0.01" required /></Field>
        <DeleteButton icon-only class="mb-0.5" :disabled="transfer.lines.length === 1" @click="removeTransferLine(i)" />
      </div>
      <Button type="button" size="sm" variant="outline" :disabled="transfer.lines.length >= tracked.length" @click="addTransferLine">
        <Plus class="size-3.5" /> {{ t('inventory.addItemLine') }}
      </Button>
    </FormDialog>

    <FormDialog
      v-model:open="adjOpen"
      :title="editingAdjId ? t('inventory.editAdj') : t('inventory.stockAdj')"
      :description="t('inventory.adjDesc')"
      :submit-label="editingAdjId ? t('inventory.saveAdj') : t('inventory.createDraft')"
      :error="error"
      wide
      :loading="saving"
      @submit="saveAdj"
    >
      <div class="grid gap-3 sm:grid-cols-3">
        <Field :label="t('inventory.warehouse')">
          <select v-model="adjustment.warehouse_id" class="select" required>
            <option value="">{{ t('common.select') }}</option>
            <option v-for="w in warehouses" :key="w.id" :value="String(w.id)">{{ w.name }}</option>
          </select>
        </Field>
        <Field :label="t('inventory.action')">
          <select v-model="adjustment.direction" class="select" required @change="onAdjDirectionChange">
            <option value="increase">{{ t('inventory.increase') }}</option>
            <option value="decrease">{{ t('inventory.decrease') }}</option>
          </select>
        </Field>
        <Field :label="t('inventory.cause')">
          <select v-model="adjustment.cause" class="select" required>
            <option v-for="c in adjCauseOptions" :key="c.id" :value="c.id">{{ t('inventory.causes.' + c.id) }}</option>
          </select>
        </Field>
      </div>
      <Field :label="t('common.notes')">
        <textarea v-model="adjustment.notes" class="textarea" :placeholder="t('inventory.notesPh')" />
      </Field>
      <div v-for="(line, i) in adjustment.lines" :key="i" class="grid items-end gap-2" :class="adjustment.direction === 'increase' ? 'grid-cols-[1fr_5.5rem_6.5rem_auto]' : 'grid-cols-[1fr_5.5rem_auto]'">
        <Field :label="t('common.item')">
          <select v-model="line.item_id" class="select" required>
            <option value="">{{ t('common.select') }}</option>
            <option v-for="item in trackedOptions(line.item_id, adjustment.lines)" :key="item.id" :value="String(item.id)">
              {{ item.sku }} — {{ item.name }}
            </option>
          </select>
        </Field>
        <Field :label="t('common.qty')"><Input v-model="line.qty" type="number" min="0.01" step="0.01" required /></Field>
        <Field v-if="adjustment.direction === 'increase'" :label="t('inventory.unitCost')">
          <Input v-model="line.unit_cost" type="number" min="0" step="1" required />
        </Field>
        <DeleteButton icon-only class="mb-0.5" :disabled="adjustment.lines.length === 1" @click="removeAdjLine(i)" />
      </div>
      <Button type="button" size="sm" variant="outline" :disabled="adjustment.lines.length >= tracked.length" @click="addAdjLine">
        <Plus class="size-3.5" /> {{ t('inventory.addItemLine') }}
      </Button>
    </FormDialog>

    <FormDialog
      v-model:open="detailOpen"
      :title="detailKind === 'transfer' ? t('inventory.transferN', { id: detail?.id }) : t('inventory.adjN', { id: detail?.id })"
      wide
      hide-submit
    >
      <template #header-extra>
        <ConversationActions
          v-if="detail?.id"
          :type="detailKind === 'transfer' ? 'transfer' : 'adjustment'"
          :id="detail.id"
          class="mt-2"
        />
      </template>
      <div v-if="detailKind === 'transfer' && detail" class="space-y-4 text-sm">
        <p>
          <span class="text-slate-500">{{ t('inventory.from') }}</span> {{ detail.from_warehouse?.name }}
          <span class="text-slate-500"> → {{ t('inventory.to') }}</span> {{ detail.to_warehouse?.name }}
        </p>
        <p>
          <span class="text-slate-500">{{ t('common.status') }}</span> {{ detail.status }}
          <span class="text-slate-500"> · {{ t('inventory.created') }}</span> {{ fmtWhen(detail.created_at) }}
          <span class="text-slate-500"> {{ t('inventory.by') }}</span> {{ personName(detail.creator) }}
        </p>
        <p v-if="detail.receiver">
          <span class="text-slate-500">{{ t('inventory.receivedBy') }}</span> {{ personName(detail.receiver) }}
        </p>
        <p v-if="detail.notes"><span class="text-slate-500">{{ t('common.notes') }}</span> {{ detail.notes }}</p>
        <div>
          <p class="mb-1 font-medium">{{ t('inventory.lines') }}</p>
          <table class="data-table">
            <thead><tr><th>{{ t('inventory.sku') }}</th><th>{{ t('common.item') }}</th><th class="text-end">{{ t('common.qty') }}</th></tr></thead>
            <tbody>
              <tr v-for="line in detail.lines || []" :key="line.id">
                <td class="font-medium">{{ line.item?.sku }}</td>
                <td>{{ line.item?.name }}</td>
                <td class="text-end">{{ fmtQty(line.qty) }}</td>
              </tr>
              <tr v-if="!detail.lines?.length"><td colspan="3" class="text-slate-400">{{ t('inventory.noLines') }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-else-if="detail" class="space-y-4 text-sm">
        <p>
          <span class="text-slate-500">{{ t('inventory.warehouse') }}</span> {{ detail.warehouse?.name }}
          <span class="text-slate-500"> · {{ t('inventory.action') }}</span> {{ adjActionLabel(detail) }}
          <span class="text-slate-500"> · {{ t('common.status') }}</span> {{ detail.status }}
        </p>
        <p>
          <span class="text-slate-500">{{ t('inventory.created') }}</span> {{ fmtWhen(detail.created_at) }}
          <span class="text-slate-500"> {{ t('inventory.by') }}</span> {{ personName(detail.creator) }}
        </p>
        <p><span class="text-slate-500">{{ t('common.reason') }}</span> {{ detail.reason }}</p>
        <div>
          <p class="mb-1 font-medium">{{ t('inventory.lines') }}</p>
          <table class="data-table">
            <thead><tr><th>{{ t('inventory.sku') }}</th><th>{{ t('common.item') }}</th><th class="text-end">{{ t('common.qty') }}</th><th class="text-end">{{ t('inventory.unitCost') }}</th></tr></thead>
            <tbody>
              <tr v-for="line in detail.lines || []" :key="line.id">
                <td class="font-medium">{{ line.item?.sku }}</td>
                <td>{{ line.item?.name }}</td>
                <td class="text-end">{{ fmtQty(Math.abs(Number(line.qty_delta))) }}</td>
                <td class="text-end">{{ line.unit_cost != null ? fmtQty(line.unit_cost) : t('common.dash') }}</td>
              </tr>
              <tr v-if="!detail.lines?.length"><td colspan="4" class="text-slate-400">{{ t('inventory.noLines') }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </FormDialog>

    <ConfirmDialog
      v-model:open="confirmOpen"
      :title="confirmTitle"
      :description="confirmDescription"
      :confirm-label="confirmLabel"
      :variant="confirmVariant"
      :loading="confirming"
      @confirm="runConfirm"
    />
  </div>
</template>
