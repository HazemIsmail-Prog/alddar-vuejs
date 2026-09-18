<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronsLeft, ChevronsRight, GripVertical } from '@lucide/vue'
import api from '@/api/client'
import { apiError, statusCardStyle } from '@/lib/utils'
import { formatPhone } from '@/lib/phone'
import Field from '@/components/ui/Field.vue'
import FormDialog from '@/components/FormDialog.vue'
import InvoiceDraftDialog from '@/components/InvoiceDraftDialog.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import PageHeader from '@/components/PageHeader.vue'
import PageTabs from '@/components/PageTabs.vue'
import SearchField from '@/components/SearchField.vue'
import EmptyState from '@/components/EmptyState.vue'
import LoadingState from '@/components/LoadingState.vue'
import ActionMenu from '@/components/ActionMenu.vue'
import ConversationActions from '@/components/ConversationActions.vue'
import OrderTimeline from '@/components/OrderTimeline.vue'
import { personName, departmentName, named } from '@/i18n'
import { useStatusStore } from '@/stores/statuses'
import { useAuthStore } from '@/stores/auth'
import { useInboxStore } from '@/stores/inbox'
import { useStaffReload } from '@/composables/useStaffEvent'
import { orderDraftInvoice } from '@/lib/orderInvoices'

const { t } = useI18n()
const auth = useAuthStore()
const inbox = useInboxStore()
const { orderUnread, unreadByDepartment } = storeToRefs(inbox)
const route = useRoute()
const router = useRouter()
const board = ref<any>({ departments: [], department_id: null, unassigned: [], planned: [], held: [], technicians: [] })
const skipDeptWatch = ref(false)
const loaded = ref(false)
const loading = ref(true)
const holdOpen = ref(false)
const invoiceOpen = ref(false)
const invoiceOrderId = ref<number | null>(null)
const invoiceDocId = ref<number | null>(null)
const historyOpen = ref(false)
const inspect = ref<any>(null)
const action = ref<'hold' | 'cancel'>('hold')
const target = ref<any>(null)
const reason = ref('')
const error = ref('')
const saving = ref(false)
const draggingId = ref<number | null>(null)
const overCol = ref<string | number | null>(null)
const overIndex = ref<number>(0)
const collapsed = ref<Set<string>>(new Set(['planned']))
let persistChain = Promise.resolve()
let persistGeneration = 0
let quietUntil = 0
const statuses = useStatusStore()
const query = ref('')

function matches(order: any) {
  const q = query.value.trim().toLowerCase()
  if (!q) return true
  return `${order.id} ${order.client?.name || ''} ${order.location?.address || ''} ${order.location?.label || ''} ${order.notes || ''} ${departmentName(order.department)} ${order.department?.name_en || ''} ${order.department?.name_ar || ''}`.toLowerCase().includes(q)
}

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayOrdersHref(kind: 'completed' | 'cancelled', extra: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  const today = todayIso()
  params.set('status', kind)
  if (kind === 'completed') {
    params.set('completed_from', today)
    params.set('completed_to', today)
  } else {
    params.set('cancelled_from', today)
    params.set('cancelled_to', today)
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return `/orders?${params}`
}

const deptTabs = computed(() =>
  (board.value.departments || []).map((d: any) => ({
    id: String(d.id),
    label: departmentName(d),
    badge: unreadByDepartment.value[d.id] || 0,
    completed: Number(d.completed_today || 0),
    cancelled: Number(d.cancelled_today || 0),
    completedHref: todayOrdersHref('completed', { department_id: d.id }),
    cancelledHref: todayOrdersHref('cancelled', { department_id: d.id }),
  })),
)

const selectedDept = computed({
  get: () => String(route.query.department || board.value.department_id || ''),
  set: (id: string) => {
    router.replace({ query: { ...route.query, department: id } })
  },
})

const hasBoards = computed(() => (board.value.departments || []).length > 0)

function unreadSum(orders: any[]) {
  return (orders || []).reduce((n, order) => n + (orderUnread.value[order.id] || 0), 0)
}

const columns = computed(() => {
  const plannedOrders = (board.value.planned || []).filter(matches)
  return [
    ...(plannedOrders.length
      ? [{
          id: 'planned' as const,
          title: t('dispatch.planned'),
          hint: t('dispatch.plannedHint'),
          orders: plannedOrders,
          unread: unreadSum(board.value.planned || []),
        }]
      : []),
    {
      id: 'unassigned' as const,
      title: t('dispatch.unassigned'),
      hint: t('dispatch.unassignedHint'),
      orders: (board.value.unassigned || []).filter(matches),
      unread: unreadSum(board.value.unassigned || []),
    },
    {
      id: 'held' as const,
      title: t('dispatch.held'),
      hint: t('dispatch.heldHint'),
      orders: (board.value.held || []).filter(matches),
      unread: unreadSum(board.value.held || []),
    },
    ...(board.value.technicians || []).map((col: any) => {
      const departmentId = selectedDept.value || board.value.department_id
      return {
        id: col.user.id as number,
        title: personName(col.user),
        hint: col.user.warehouse?.name || t('common.technician'),
        orders: (col.orders || []).filter(matches),
        unread: unreadSum(col.orders || []),
        completedToday: Number(col.completed_today || 0),
        cancelledToday: Number(col.cancelled_today || 0),
        completedHref: todayOrdersHref('completed', { department_id: departmentId, technician_id: col.user.id }),
        cancelledHref: todayOrdersHref('cancelled', { department_id: departmentId, technician_id: col.user.id }),
      }
    }),
  ]
})

function isQueueColumn(id: string | number) {
  return id === 'unassigned' || id === 'planned' || id === 'held'
}

function colKey(id: string | number) {
  return String(id)
}

function isCollapsed(id: string | number) {
  return collapsed.value.has(colKey(id))
}

function toggleCollapse(id: string | number) {
  const next = new Set(collapsed.value)
  const key = colKey(id)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsed.value = next
}

function expandIfOccupied(id: string | number) {
  if (id === 'planned') return
  const key = colKey(id)
  if (!collapsed.value.has(key)) return
  const next = new Set(collapsed.value)
  next.delete(key)
  collapsed.value = next
}

function emptyColumnKeys() {
  const keys = ['unassigned', 'held', 'planned']
    .filter((id) => !(board.value[id] || []).length)
  for (const col of board.value.technicians || []) {
    if (!(col.orders || []).length) keys.push(String(col.user.id))
  }
  return keys
}

function collapseEmptyColumns() {
  const empty = emptyColumnKeys()
  if (empty.every((key) => collapsed.value.has(key))) return
  const next = new Set(collapsed.value)
  empty.forEach((key) => next.add(key))
  collapsed.value = next
}

function syncCollapsed() {
  collapsed.value = new Set([
    'planned',
    ...emptyColumnKeys(),
  ])
}

function isLocked(order: any) {
  return order.status === 'accepted' || order.status === 'reached'
}

function unlocked(orders: any[]) {
  return orders.filter((order) => !isLocked(order))
}

function locked(orders: any[]) {
  return orders.filter((order) => isLocked(order))
}

function findOrder(id: number) {
  for (const order of [...(board.value.unassigned || []), ...(board.value.planned || []), ...(board.value.held || [])]) {
    if (order.id === id) return order
  }
  for (const col of board.value.technicians || []) {
    const order = (col.orders || []).find((row: any) => row.id === id)
    if (order) return order
  }
  return null
}

function snapshotBoard() {
  return JSON.parse(JSON.stringify(board.value))
}

function hushRealtime() {
  quietUntil = Date.now() + 2500
}

function persistMove(task: () => Promise<unknown>, snap: any) {
  const gen = persistGeneration
  hushRealtime()
  persistChain = persistChain.then(async () => {
    if (gen !== persistGeneration) return
    try {
      await task()
      if (gen === persistGeneration) hushRealtime()
    } catch (e) {
      if (gen !== persistGeneration) return
      persistGeneration += 1
      error.value = apiError(e)
      board.value = snap
      hushRealtime()
      await load()
    }
  })
}

function queueOrders(queue: string) {
  if (queue === 'held') return board.value.held || []
  if (queue === 'planned') return board.value.planned || []
  return board.value.unassigned || []
}

function setQueueOrders(queue: string, orders: any[]) {
  if (queue === 'held') board.value.held = orders
  else if (queue === 'planned') board.value.planned = orders
  else board.value.unassigned = orders
}

function takeOrder(id: number) {
  const order = findOrder(id)
  if (!order) return null
  board.value.unassigned = (board.value.unassigned || []).filter((row: any) => row.id !== id)
  board.value.planned = (board.value.planned || []).filter((row: any) => row.id !== id)
  board.value.held = (board.value.held || []).filter((row: any) => row.id !== id)
  for (const col of board.value.technicians || []) {
    col.orders = (col.orders || []).filter((row: any) => row.id !== id)
  }
  return order
}

function assignedStatus(order: any) {
  return order.status === 'pending' || order.status === 'on_hold' ? 'assigned' : order.status
}

function holdReason(order: any) {
  return order.hold_reason
    || [...(order.statusHistory || [])].reverse().find((row: any) => row.to_status === 'on_hold')?.reason
}

function cardNote(order: any) {
  return order.location?.address || order.location?.label || t('dispatch.noAddress')
}

function cardNotes(order: any) {
  return String(order.notes || '').trim()
}

function cardPhone(order: any) {
  return formatPhone(order.phone)
}

function cardContract(order: any) {
  if (!order.contract) return ''
  return `${t('orders.contract')}: ${named('contractType', order.contract.type)} #${order.contract.id}`
}

function dateKey(value?: string | null) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isFutureOrder(order: any) {
  const date = dateKey(order.planned_date)
  return !!date && date > todayKey()
}

function waitingQueueId(order: any) {
  if (order.technician_id || order.status === 'on_hold') return null
  return isFutureOrder(order) ? 'planned' : 'unassigned'
}

function nextUpOrderId(orders: any[]) {
  return unlocked(orders).find((order) => !isFutureOrder(order))?.id ?? null
}

function fmtPlanDate(value?: string | null) {
  const date = dateKey(value)
  if (!date) return ''
  const parts = date.split('-').map(Number)
  const y = parts[0]
  const m = parts[1]
  const d = parts[2]
  if (!y || !m || !d) return date
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function cardAccent(order: any) {
  if (isFutureOrder(order) && !isLocked(order)) {
    return {
      borderWidth: '2px',
      borderStyle: 'solid',
      borderColor: '#000',
      backgroundColor: 'color-mix(in srgb, #000 16%, white)',
    }
  }
  return statusCardStyle(statuses.meta(order.status)?.color)
}

function isFocused(order: any) {
  return Number(route.query.order) === Number(order.id)
}

function convoStart(order: any): 'comments' | 'files' | '' {
  if (!isFocused(order)) return ''
  if (route.hash === '#files') return 'files'
  if (route.hash === '#comments') return 'comments'
  return ''
}

function expandOrderColumn(orderId: number) {
  if (!orderId) return
  for (const col of columns.value) {
    if (!col.orders.some((row: any) => row.id === orderId)) continue
    if (col.id === 'planned') continue
    if (isCollapsed(col.id)) toggleCollapse(col.id)
  }
}

function onDragStart(event: DragEvent, order: any) {
  if (isLocked(order)) {
    event.preventDefault()
    return
  }
  draggingId.value = order.id
  event.dataTransfer?.setData('text/plain', String(order.id))
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    const card = (event.currentTarget as HTMLElement).closest('article')
    if (card) event.dataTransfer.setDragImage(card, 24, 24)
  }
}

function onDragEnd() {
  draggingId.value = null
  overCol.value = null
}

function onDragOver(event: DragEvent, colId: string | number, index: number) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  overCol.value = colId
  overIndex.value = index
}

async function onDrop(event: DragEvent, colId: string | number) {
  event.preventDefault()
  const raw = event.dataTransfer?.getData('text/plain')
  const id = Number(raw || draggingId.value)
  const index = overIndex.value
  onDragEnd()
  if (!id) return
  const order = findOrder(id)
  if (!order) return

  if (isQueueColumn(colId)) {
    if (colId === 'held') {
      if (order.status === 'on_hold') {
        reorderQueue('held', order, index)
        return
      }
      openHold(order, 'hold')
      return
    }
    const queue = waitingQueueId(order)
    if (queue === colId) {
      reorderQueue(String(colId), order, index)
      return
    }
    if (queue) return
    if (order.status === 'on_hold') return
    openHold(order, 'hold')
    return
  }

  placeOnTech(order, Number(colId), index)
}

function reorderQueue(queue: string, order: any, insertIndex: number) {
  const list = queueOrders(queue)
  const oldIndex = list.findIndex((row: any) => row.id === order.id)
  const movable = list.filter((row: any) => row.id !== order.id)

  let at = insertIndex
  if (oldIndex !== -1 && oldIndex < at) at -= 1
  at = Math.min(Math.max(at, 0), movable.length)
  if (oldIndex === at) return

  movable.splice(at, 0, order)
  const snap = snapshotBoard()
  setQueueOrders(queue, movable)
  error.value = ''
  expandIfOccupied(queue)
  persistMove(
    () => api.post('/api/dispatch/reorder', { queue, order_ids: movable.map((row: any) => row.id) }),
    snap,
  )
}

function techsFor(order: any) {
  return (board.value.technicians || [])
    .map((col: any) => col.user)
    .filter((user: any) => Number(user.id) !== Number(order.technician_id))
}

function quickAssign(order: any, event: Event) {
  const select = event.target as HTMLSelectElement
  const techId = Number(select.value)
  select.selectedIndex = 0
  if (!techId || Number(order.technician_id) === techId) return
  const col = (board.value.technicians || []).find((row: any) => row.user.id === techId)
  placeOnTech(order, techId, unlocked(col?.orders || []).length)
}

function placeOnTech(order: any, techId: number, insertIndex: number) {
  const col = (board.value.technicians || []).find((row: any) => row.user.id === techId)
  if (!col) return

  const sameTech = Number(order.technician_id) === techId
  const oldIndex = unlocked(col.orders).findIndex((row: any) => row.id === order.id)
  const pinned = locked(col.orders).filter((row: any) => row.id !== order.id)
  const movable = unlocked(col.orders).filter((row: any) => row.id !== order.id)

  let at = insertIndex
  if (sameTech && oldIndex !== -1 && oldIndex < at) at -= 1
  at = Math.min(Math.max(at, 0), movable.length)
  if (sameTech && oldIndex === at) return

  const snap = snapshotBoard()
  const moved = sameTech ? order : takeOrder(order.id)
  if (!moved) return
  if (!sameTech) {
    moved.technician_id = techId
    moved.status = assignedStatus(moved)
  }
  movable.splice(at, 0, moved)
  col.orders = [...pinned, ...movable]
  const orderIds = col.orders.map((row: any) => row.id)
  error.value = ''
  expandIfOccupied(techId)
  persistMove(async () => {
    if (!sameTech) {
      await api.post(`/api/orders/${moved.id}/assign`, {
        technician_id: techId,
        sort_order: pinned.length + at + 1,
      })
    }
    await api.post(`/api/technicians/${techId}/reorder`, { order_ids: orderIds })
  }, snap)
}

async function load() {
  const params: Record<string, number> = {}
  const dept = Number(route.query.department)
  const order = Number(route.query.order)
  if (dept) params.department_id = dept
  if (order) params.order = order
  try {
    board.value = (await api.get('/api/dispatch/board', { params })).data
    const resolved = board.value.department_id
    if (resolved && String(route.query.department || '') !== String(resolved)) {
      skipDeptWatch.value = true
      await router.replace({ query: { ...route.query, department: String(resolved) } })
      await nextTick()
      skipDeptWatch.value = false
    }
    syncCollapsed()
    expandOrderColumn(Number(route.query.order))
  } catch (e) {
    error.value = apiError(e)
  } finally {
    loaded.value = true
    loading.value = false
  }
}

function openHold(order: any, kind: 'hold' | 'cancel') {
  target.value = order
  action.value = kind
  reason.value = ''
  error.value = ''
  holdOpen.value = true
}

async function submitHold() {
  if (saving.value) return
  error.value = ''
  saving.value = true
  try {
    await api.post(`/api/orders/${target.value.id}/${action.value}`, { reason: reason.value })
    holdOpen.value = false
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

function cardActions(order: any) {
  return [
    { id: 'details', label: t('orders.details') },
    { id: 'history', label: t('orders.history') },
    { id: 'hold', label: t('dispatch.hold'), show: auth.can('orders.hold') && order.status !== 'on_hold' },
    { id: 'cancel', label: t('dispatch.cancel'), danger: true, show: auth.can('orders.cancel') },
    {
      id: 'invoice',
      label: orderDraftInvoice(order) ? t('dispatch.invoiceTitle') : t('tech.createInvoice'),
      show: canManageInvoice(order),
    },
  ]
}

function onCardAction(order: any, id: string) {
  if (id === 'details') openOrderPage(order)
  if (id === 'history') void openHistory(order)
  if (id === 'hold') openHold(order, 'hold')
  if (id === 'cancel') openHold(order, 'cancel')
  if (id === 'invoice') openInvoice(order)
}

function openOrderPage(order: any) {
  window.open(router.resolve(`/orders/${order.id}`).href, '_blank', 'noopener')
}

async function openHistory(order: any) {
  error.value = ''
  try {
    inspect.value = (await api.get(`/api/orders/${order.id}`)).data
    historyOpen.value = true
  } catch (e) {
    error.value = apiError(e)
  }
}

onMounted(() => {
  void inbox.load()
  load()
})

useStaffReload((e) => {
  if (Date.now() < quietUntil) return false
  if (e.kind !== 'order') return false
  const dept = Number(board.value.department_id)
  return !e.department_id || !dept || Number(e.department_id) === dept
}, load)

watch(
  () => [
    (board.value.unassigned || []).length,
    (board.value.planned || []).length,
    (board.value.held || []).length,
    ...(board.value.technicians || []).map((col: any) => `${col.user.id}:${(col.orders || []).length}`),
  ].join('|'),
  collapseEmptyColumns,
)

watch(() => [route.query.order, route.hash], () => {
  expandOrderColumn(Number(route.query.order))
})

watch(
  () => String(route.query.department || ''),
  (id, prev) => {
    if (skipDeptWatch.value || id === prev) return
    loading.value = true
    void load()
  },
)
</script>

<template>
  <div>
    <PageHeader :title="t('dispatch.title')" :subtitle="t('dispatch.subtitle')">
      <template #actions>
        <SearchField v-model="query" :placeholder="t('dispatch.searchPh')" class="sm:w-64" />
      </template>
    </PageHeader>
    <p v-if="error && !holdOpen && !invoiceOpen && !historyOpen" class="mb-4 text-sm text-red-600">{{ error }}</p>

    <PageTabs v-if="deptTabs.length" v-model="selectedDept" :tabs="deptTabs" />

    <LoadingState v-if="loading && !hasBoards" />
    <EmptyState
      v-else-if="loaded && !hasBoards"
      :title="t('dispatch.emptyTitle')"
      :description="t('dispatch.emptyHint')"
    />

    <div v-else-if="hasBoards" class="relative flex gap-4 overflow-x-auto pb-4 md:h-[calc(100vh-11rem)] md:min-h-[28rem]">
      <section
        v-for="col in columns"
        :key="col.id"
        class="flex shrink-0 flex-col overflow-hidden rounded-2xl border"
        :class="[
          overCol === col.id ? 'border-accent ring-2 ring-accent/20' : 'border-slate-200',
          col.id === 'held' ? 'bg-amber-50/70 dark:bg-amber-950/40' : 'bg-slate-50/80',
          isCollapsed(col.id) ? 'w-12' : 'w-80',
        ]"
        @dragover.prevent="onDragOver($event, col.id, unlocked(col.orders).length)"
        @drop="onDrop($event, col.id)"
      >
        <div
          v-if="isCollapsed(col.id)"
          class="flex min-h-72 flex-1 flex-col items-center gap-3 px-1 py-3 text-slate-600"
        >
          <button
            type="button"
            class="flex flex-col items-center gap-3 hover:bg-white/50"
            :title="t('dispatch.expand', { title: col.title })"
            @click="toggleCollapse(col.id)"
          >
            <ChevronsRight class="size-4 shrink-0 rtl:rotate-180" />
            <span class="[writing-mode:vertical-rl] rotate-180 text-sm font-semibold">{{ col.title }}</span>
            <span v-if="col.orders.length" class="rounded-full bg-white px-1.5 text-xs font-medium text-slate-600">{{ col.orders.length }}</span>
            <span
              v-if="col.unread"
              class="min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 font-medium text-white"
            >{{ col.unread > 99 ? '99+' : col.unread }}</span>
          </button>
          <a
            v-if="col.completedToday && col.completedHref"
            :href="col.completedHref"
            target="_blank"
            rel="noopener noreferrer"
            class="min-w-4 rounded-full bg-emerald-600 px-1 text-center text-[10px] leading-4 font-medium tabular-nums text-white hover:bg-emerald-700"
            :title="t('dispatch.completedToday', { n: col.completedToday })"
            @click.stop
          >{{ col.completedToday }}</a>
          <a
            v-if="col.cancelledToday && col.cancelledHref"
            :href="col.cancelledHref"
            target="_blank"
            rel="noopener noreferrer"
            class="min-w-4 rounded-full bg-slate-500 px-1 text-center text-[10px] leading-4 font-medium tabular-nums text-white hover:bg-slate-600"
            :title="t('dispatch.cancelledToday', { n: col.cancelledToday })"
            @click.stop
          >{{ col.cancelledToday }}</a>
        </div>

        <template v-else>
          <header class="border-b border-slate-200 px-3 py-3">
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-700"
                :title="t('dispatch.collapse', { title: col.title })"
                @click="toggleCollapse(col.id)"
              >
                <ChevronsLeft class="size-4 rtl:rotate-180" />
              </button>
              <h2 class="min-w-0 flex-1 truncate font-semibold">{{ col.title }}</h2>
              <span
                v-if="col.unread"
                class="min-w-4 shrink-0 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 font-medium text-white"
              >{{ col.unread > 99 ? '99+' : col.unread }}</span>
              <span v-if="col.orders.length" class="text-xs text-slate-500">{{ col.orders.length }}</span>
              <a
                v-if="col.completedToday && col.completedHref"
                :href="col.completedHref"
                target="_blank"
                rel="noopener noreferrer"
                class="shrink-0 rounded-full bg-emerald-600 px-1.5 text-[10px] leading-4 font-medium text-white hover:bg-emerald-700"
                :title="t('dispatch.completedToday', { n: col.completedToday })"
                @click.stop
              >{{ t('dispatch.completedToday', { n: col.completedToday }) }}</a>
              <a
                v-if="col.cancelledToday && col.cancelledHref"
                :href="col.cancelledHref"
                target="_blank"
                rel="noopener noreferrer"
                class="shrink-0 rounded-full bg-slate-500 px-1.5 text-[10px] leading-4 font-medium text-white hover:bg-slate-600"
                :title="t('dispatch.cancelledToday', { n: col.cancelledToday })"
                @click.stop
              >{{ t('dispatch.cancelledToday', { n: col.cancelledToday }) }}</a>
            </div>
            <p class="mt-1 ps-7 text-xs text-slate-500">{{ col.hint }}</p>
          </header>

          <div class="flex min-h-72 flex-1 flex-col gap-2 overflow-y-auto p-3">
          <article
            v-for="order in locked(col.orders)"
            :key="order.id"
            class="rounded-xl border-2 p-3"
            :class="isFocused(order) && 'ring-2 ring-accent/30'"
            :style="cardAccent(order)"
          >
            <div class="mb-1 flex items-start justify-between gap-2">
              <RouterLink :to="`/orders/${order.id}`" class="font-medium hover:text-accent">#{{ order.id }} {{ order.client?.name }}</RouterLink>
              <div class="flex items-center gap-1">
                <StatusBadge :status="order.status" />
                <ActionMenu :items="cardActions(order)" :badge="orderUnread[order.id]" @select="onCardAction(order, $event)" />
              </div>
            </div>
            <p v-if="cardContract(order)" class="mt-0.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">{{ cardContract(order) }}</p>
            <p class="text-xs leading-relaxed break-words text-slate-600">{{ cardNote(order) }}</p>
            <p v-if="cardPhone(order)" class="mt-0.5 truncate text-xs tabular-nums text-slate-500">{{ cardPhone(order) }}</p>
            <p v-if="cardNotes(order)" class="mt-1 line-clamp-3 text-xs leading-relaxed break-words text-slate-600 dark:text-slate-300">{{ cardNotes(order) }}</p>
            <p v-if="isFutureOrder(order)" class="mt-0.5 text-[11px] text-slate-400">{{ t('dispatch.later', { date: fmtPlanDate(order.planned_date) }) }}</p>
            <p class="mt-1 text-[11px] font-medium tracking-wide text-teal-800 uppercase">{{ t('dispatch.onJob') }}</p>
            <div class="mt-2" @mousedown.stop @pointerdown.stop>
              <ConversationActions
                type="order"
                :id="order.id"
                size="sm"
                class="w-full [&>button]:flex-1"
                :follow-hash="false"
                :start-with="convoStart(order)"
              />
            </div>
          </article>

          <div
            v-for="(order, idx) in unlocked(col.orders)"
            :key="order.id"
            class="relative"
            @dragover.prevent.stop="onDragOver($event, col.id, idx)"
            @drop.stop="onDrop($event, col.id)"
          >
            <div
              v-if="overCol === col.id && overIndex === idx && draggingId !== order.id"
              class="mb-2 h-1 rounded-full bg-accent"
            />
            <article
              class="rounded-xl border-2 p-3 shadow-sm"
              :class="[draggingId === order.id && 'opacity-40', isFocused(order) && 'ring-2 ring-accent/30']"
              :style="cardAccent(order)"
            >
              <div class="flex items-start gap-2">
                <div
                  class="mt-0.5 shrink-0 cursor-grab rounded text-slate-400 hover:text-slate-600 active:cursor-grabbing"
                  :draggable="true"
                  role="button"
                  tabindex="0"
                  :aria-label="t('dispatch.dragAria')"
                  @dragstart="onDragStart($event, order)"
                  @dragend="onDragEnd"
                >
                  <GripVertical class="size-4 pointer-events-none" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="mb-1 flex items-start justify-between gap-2">
                    <RouterLink :to="`/orders/${order.id}`" class="font-medium hover:text-accent">#{{ order.id }} {{ order.client?.name }}</RouterLink>
                    <div class="flex items-center gap-1">
                      <StatusBadge :status="order.status" />
                      <ActionMenu :items="cardActions(order)" :badge="orderUnread[order.id]" @select="onCardAction(order, $event)" />
                    </div>
                  </div>
                  <p v-if="cardContract(order)" class="mt-0.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">{{ cardContract(order) }}</p>
                  <p class="text-xs leading-relaxed break-words text-slate-500">{{ cardNote(order) }}</p>
                  <p v-if="cardPhone(order)" class="mt-0.5 truncate text-xs tabular-nums text-slate-500">{{ cardPhone(order) }}</p>
                  <p v-if="cardNotes(order)" class="mt-1 line-clamp-3 text-xs leading-relaxed break-words text-slate-600 dark:text-slate-300">{{ cardNotes(order) }}</p>
                  <p v-if="isFutureOrder(order)" class="mt-0.5 text-[11px] text-slate-400">{{ t('dispatch.later', { date: fmtPlanDate(order.planned_date) }) }}</p>
                  <p v-if="order.status === 'on_hold' && holdReason(order)" class="mt-1 text-xs text-amber-800">{{ holdReason(order) }}</p>
                  <p v-if="!isQueueColumn(col.id) && order.id === nextUpOrderId(col.orders)" class="mt-1 text-[11px] font-medium tracking-wide text-accent uppercase">{{ t('dispatch.nextUp') }}</p>
                  <div class="mt-2" @mousedown.stop @pointerdown.stop>
                    <ConversationActions
                      type="order"
                      :id="order.id"
                      size="sm"
                      class="w-full [&>button]:flex-1"
                      :follow-hash="false"
                      :start-with="convoStart(order)"
                    />
                  </div>
                  <select
                    v-if="techsFor(order).length"
                    class="select mt-2 h-8 py-0 text-xs"
                    @mousedown.stop
                    @click.stop
                    @change="quickAssign(order, $event)"
                  >
                    <option value="">{{ order.technician_id ? t('dispatch.moveTo') : t('dispatch.assignTo') }}</option>
                    <option v-for="tech in techsFor(order)" :key="tech.id" :value="tech.id">{{ personName(tech) }}</option>
                  </select>
                </div>
              </div>
            </article>
          </div>

          <div
            class="mt-auto min-h-16 rounded-xl border border-dashed px-3 py-6 text-center text-xs"
            :class="overCol === col.id && overIndex >= unlocked(col.orders).length ? 'border-accent bg-accent/5 text-accent' : 'border-slate-200 text-slate-400'"
            @dragover.prevent.stop="onDragOver($event, col.id, unlocked(col.orders).length)"
            @drop.stop="onDrop($event, col.id)"
          >
            {{ col.orders.length ? t('dispatch.dropEnd') : (col.id === 'held' ? t('dispatch.noHeld') : (col.id === 'unassigned' ? t('dispatch.noWaiting') : (col.id === 'planned' ? t('dispatch.noPlanned') : t('dispatch.dropHere')))) }}
          </div>
          </div>
        </template>
      </section>
      <LoadingState v-if="loading" overlay />
    </div>

    <FormDialog
      v-model:open="holdOpen"
      :title="action === 'hold' ? t('dispatch.holdTitle') : t('dispatch.cancelTitle')"
      :description="action === 'hold' ? t('dispatch.holdDesc') : t('dispatch.cancelDesc')"
      :submit-label="action === 'hold' ? t('dispatch.hold') : t('dispatch.cancelSubmit')"
      :destructive="action === 'cancel'"
      :error="error"
      :loading="saving"
      @submit="submitHold"
    >
      <Field :label="t('common.reason')"><textarea v-model="reason" class="textarea" required /></Field>
    </FormDialog>

    <FormDialog
      v-model:open="historyOpen"
      :title="t('orders.history')"
      hide-submit
    >
      <OrderTimeline compact :items="inspect?.status_history" />
    </FormDialog>

    <InvoiceDraftDialog
      v-model:open="invoiceOpen"
      :order-id="invoiceOrderId"
      :invoice-id="invoiceDocId"
      @saved="load"
    />
  </div>
</template>
