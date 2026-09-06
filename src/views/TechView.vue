<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import {
  Check,
  CircleCheck,
  FileText,
  MapPin,
  Navigation,
  Package,
  Wallet,
  Wrench,
} from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import { apiError } from '@/lib/utils'
import { machineLabel } from '@/lib/machines'
import { invoiceLinesPayload, linesFromInvoice, type InvoiceEditLine } from '@/lib/invoiceLines'
import { formatPhone, phoneDigits } from '@/lib/phone'
import { Button } from '@/components/ui/button'
import DeleteButton from '@/components/DeleteButton.vue'
import Field from '@/components/ui/Field.vue'
import FormDialog from '@/components/FormDialog.vue'
import InvoiceLinesEditor from '@/components/InvoiceLinesEditor.vue'
import ReceivePaymentDialog, { type PaymentDue } from '@/components/ReceivePaymentDialog.vue'
import PhoneActions from '@/components/PhoneActions.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import ConversationActions from '@/components/ConversationActions.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageTabs from '@/components/PageTabs.vue'
import { named, personName, departmentName } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useInboxStore } from '@/stores/inbox'
import { useStaffReload } from '@/composables/useStaffEvent'
import { useReceivePayment } from '@/composables/useReceivePayment'
import { orderDraftInvoice, orderHasInvoice, orderInvoices } from '@/lib/orderInvoices'
import { canOfferPush, enableTechPush, needsIosInstallHint } from '@/lib/push'

const { t } = useI18n()
const auth = useAuthStore()
const inbox = useInboxStore()
const { unreadByDepartment } = storeToRefs(inbox)
const route = useRoute()
const router = useRouter()

const job = ref<any>(null)
const queue = ref<any[]>([])
const departments = ref<any[]>([])
const departmentId = ref<number | null>(null)
const skipDeptWatch = ref(false)
const items = ref<any[]>([])
const vanStock = ref<any[]>([])
const incomingTransfers = ref<any[]>([])
const receiveOpen = ref(false)
const receivingTransfer = ref<any>(null)
const receiving = ref(false)
const missing = ref(false)
const loading = ref(true)
const acting = ref(false)
const invoiceOpen = ref(false)
const deleteOpen = ref(false)
const deletingInvoice = ref<any>(null)
const error = ref('')
const saving = ref(false)
const confirming = ref(false)
const lines = ref<InvoiceEditLine[]>([])
const { payOpen, payPreset, openReceive } = useReceivePayment()
const report = ref('')
const showIosHint = ref(false)
const showEnablePush = ref(false)
const pushDenied = ref(false)

const machines = computed(() => job.value?.contract?.machines ?? job.value?.location?.machines ?? [])
const locationMachines = computed(() => job.value?.location?.machines ?? [])
const coveredMachineIds = computed(() => (job.value?.contract?.machines || []).map((m: any) => Number(m.id)))
const jobInvoices = computed(() => orderInvoices(job.value))
const draftInvoice = computed(() => orderDraftInvoice(job.value))
const hasInvoice = computed(() => orderHasInvoice(job.value))
const contactPhone = computed(() => job.value?.phone || null)
const mapsLink = computed(() => {
  const link = String(job.value?.location?.google_maps_link ?? '').trim()
  if (!link) return ''
  return /^https?:\/\//i.test(link) ? link : `https://${link}`
})
const jobLocked = computed(() => auth.isFieldTech() && job.value?.status === 'assigned')
const stepIndex = computed(() => {
  const status = job.value?.status
  if (status === 'assigned') return 0
  if (status === 'accepted') return 1
  if (status === 'reached') return 2
  return -1
})
const steps = computed(() => [
  { label: t('tech.stepAccept') },
  { label: t('tech.stepArrive') },
  { label: t('tech.stepFinish') },
])
const primaryAction = computed(() => {
  const current = job.value
  if (!current) return null
  if (current.status === 'assigned' && auth.can('orders.accept')) {
    return { kind: 'accept' as const, label: t('tech.accept'), icon: Check }
  }
  if (current.status === 'accepted' && auth.can('orders.reached')) {
    return { kind: 'reached' as const, label: t('tech.arrived'), icon: Navigation }
  }
  if (current.status === 'reached' && !hasInvoice.value && auth.can('invoices.create')) {
    return { kind: 'invoice' as const, label: t('tech.createInvoice'), icon: FileText }
  }
  if (current.status === 'reached' && hasInvoice.value && auth.can('orders.complete')) {
    return { kind: 'complete' as const, label: t('tech.complete'), icon: CircleCheck }
  }
  return null
})
const actingLabel = computed(() => {
  const kind = primaryAction.value?.kind
  if (kind === 'accept') return t('tech.accepting')
  if (kind === 'reached') return t('tech.arriving')
  if (kind === 'complete') return t('tech.completing')
  return t('common.loading')
})
const showCreateInvoice = computed(() =>
  job.value?.status === 'reached' && !draftInvoice.value && hasInvoice.value && auth.can('invoices.create'),
)
const showEditInvoice = computed(() =>
  job.value?.status === 'reached' && draftInvoice.value?.status === 'draft' && auth.can('invoices.update'),
)
const showCollect = computed(() => jobInvoices.value.some((invoice: any) => invoice.status === 'confirmed') && auth.can('payments.collect'))
const techDues = computed<PaymentDue[]>(() =>
  jobInvoices.value
    .filter((invoice: any) => invoice.status === 'confirmed' && Number(invoice.remaining || 0) > 0)
    .map((invoice: any) => ({
      type: 'invoice' as const,
      id: invoice.id,
      remaining: Number(invoice.remaining || 0),
      label: t('clients.forInvoice', { id: invoice.id }),
    })),
)

const pendingIncoming = computed(() => {
  const vanId = Number(auth.user?.warehouse?.id || 0)
  if (!vanId) return []
  return incomingTransfers.value.filter((xfer) => {
    if (xfer.status !== 'in_transit') return false
    return Number(xfer.to_warehouse?.id) === vanId
  })
})

function vanQty(itemId: number) {
  const row = vanStock.value.find((r) => r.item_id === itemId)
  return row ? Number(row.qty) : 0
}

function fmtQty(n: number | string) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function itemLabel(item: any) {
  if (item.type !== 'tracked_part') return item.name
  return t('tech.onVan', { name: item.name, qty: fmtQty(vanQty(item.id)) })
}

function lineName(line: any) {
  return line.item?.name || line.description || t('common.dash')
}

function transferLineSummary(xfer: any) {
  return (xfer.lines || []).map((line: any) => {
    const name = line.item?.name || line.item?.sku || t('common.dash')
    return `${name} × ${fmtQty(line.qty)}`
  }).join(', ')
}

async function loadVanData() {
  try {
    vanStock.value = (await api.get('/api/stock-levels')).data
  } catch {
    vanStock.value = []
  }
  if (!auth.can('transfers.view')) {
    incomingTransfers.value = []
    return
  }
  try {
    incomingTransfers.value = (await api.get('/api/transfers')).data
  } catch {
    incomingTransfers.value = []
  }
}

function askReceive(xfer: any) {
  error.value = ''
  receivingTransfer.value = xfer
  receiveOpen.value = true
}

async function confirmReceive() {
  if (!receivingTransfer.value || receiving.value) return
  receiving.value = true
  error.value = ''
  try {
    await api.post(`/api/transfers/${receivingTransfer.value.id}/receive`)
    receiveOpen.value = false
    receivingTransfer.value = null
    await loadVanData()
  } catch (e) {
    error.value = apiError(e)
    receiveOpen.value = false
  } finally {
    receiving.value = false
  }
}

async function loadCatalog() {
  const departmentId = job.value?.department_id
  if (!departmentId) {
    items.value = []
    return
  }
  items.value = (await api.get('/api/items', { params: { department_id: departmentId, sellable: 1 } })).data
}

async function load() {
  const params: Record<string, number> = {}
  const dept = Number(route.query.department)
  if (dept) params.department_id = dept
  try {
    const data = (await api.get('/api/tech/current', { params })).data
    departments.value = data.departments || []
    departmentId.value = data.department_id
    job.value = data.current
    queue.value = data.queue || []
    missing.value = !data.current
    if (auth.isFieldTech()) {
      const currents = data.currents && typeof data.currents === 'object' ? data.currents : {}
      const ids = Object.values(currents).map((id) => Number(id)).filter((id) => id > 0)
      inbox.limitOrderThreads(ids.length ? ids : (data.current ? [Number(data.current.id)] : []))
    } else {
      inbox.limitOrderThreads(null)
    }
    void inbox.load()
    if ((!data.current || (auth.isFieldTech() && data.current.status === 'assigned')) && (route.hash === '#comments' || route.hash === '#files')) {
      skipDeptWatch.value = true
      await router.replace({ query: route.query, hash: '' })
      await nextTick()
      skipDeptWatch.value = false
    }
    const resolved = data.department_id
    if (resolved && String(route.query.department || '') !== String(resolved)) {
      skipDeptWatch.value = true
      await router.replace({ query: { ...route.query, department: String(resolved) } })
      await nextTick()
      skipDeptWatch.value = false
    }
    if (!jobLocked.value) await loadCatalog()
  } catch (e) {
    error.value = apiError(e)
    job.value = null
    queue.value = []
    missing.value = true
    items.value = []
    if (auth.isFieldTech()) inbox.limitOrderThreads([])
  }
}

const deptTabs = computed(() =>
  departments.value.map((d: any) => ({
    id: String(d.id),
    label: departmentName(d),
    badge: unreadByDepartment.value[Number(d.id)] || 0,
  })),
)

const selectedDept = computed({
  get: () => String(route.query.department || departmentId.value || ''),
  set: (id: string) => {
    router.replace({ query: { ...route.query, department: id } })
  },
})

const hasDepartments = computed(() => departments.value.length > 0)

async function act(path: string) {
  if (acting.value || !job.value?.id) return
  error.value = ''
  acting.value = true
  try {
    await api.post(`/api/orders/${job.value.id}/${path}`)
    await load()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    acting.value = false
  }
}

function runPrimary() {
  const action = primaryAction.value
  if (!action || acting.value) return
  if (action.kind === 'invoice') {
    openInvoice()
    return
  }
  void act(action.kind)
}

function openInvoice() {
  error.value = ''
  lines.value = linesFromInvoice(draftInvoice.value?.items)
  report.value = draftInvoice.value?.report || ''
  invoiceOpen.value = true
}

function askDeleteInvoice(invoice: any) {
  error.value = ''
  deletingInvoice.value = invoice
  deleteOpen.value = true
}

async function deleteInvoice() {
  if (!deletingInvoice.value || confirming.value) return
  error.value = ''
  confirming.value = true
  try {
    await api.delete(`/api/invoices/${deletingInvoice.value.id}`)
    deleteOpen.value = false
    deletingInvoice.value = null
    await loadVanData()
    await load()
  } catch (e) {
    error.value = apiError(e)
    deleteOpen.value = false
  } finally {
    confirming.value = false
  }
}

async function submitInvoice() {
  if (saving.value) return
  error.value = ''
  const itemsPayload = invoiceLinesPayload(lines.value)
  if (!itemsPayload.length) {
    error.value = t('tech.needItem')
    return
  }
  const reportText = report.value.trim()
  if (!reportText) {
    error.value = t('tech.needReport')
    return
  }
  saving.value = true
  try {
    if (draftInvoice.value) {
      await api.put(`/api/invoices/${draftInvoice.value.id}`, { items: itemsPayload, report: reportText })
    } else {
      await api.post(`/api/orders/${job.value.id}/invoice`, { items: itemsPayload, report: reportText })
    }
    invoiceOpen.value = false
    await loadVanData()
    await load()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}

function openPay() {
  const due = techDues.value[0]
  openReceive(due ? { type: due.type, id: due.id } : { type: 'credit' })
}

async function onPaid() {
  await load()
}

function refreshPushHint() {
  showIosHint.value = auth.isFieldTech() && needsIosInstallHint()
  showEnablePush.value = auth.isFieldTech() && canOfferPush()
  pushDenied.value = showEnablePush.value && Notification.permission === 'denied'
}

async function requestPush() {
  await enableTechPush()
  refreshPushHint()
}

onMounted(async () => {
  refreshPushHint()
  void inbox.load()
  try {
    await loadVanData()
    await load()
  } finally {
    loading.value = false
  }
})

watch(
  () => String(route.query.department || ''),
  (id, prev) => {
    if (skipDeptWatch.value || acting.value || id === prev) return
    void load()
  },
)

useStaffReload((e) => {
  if (e.kind !== 'order') return false
  const me = Number(auth.user?.id)
  const currentId = Number(job.value?.id) || 0
  const orderId = Number(e.order_id) || 0
  const techId = e.technician_id == null ? 0 : Number(e.technician_id)

  if (currentId && orderId === currentId) return true
  return techId === me
}, load)
</script>

<template>
  <div class="mx-auto max-w-lg space-y-4 pb-32 md:pb-0">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight">{{ t('tech.title') }}</h1>
      <p class="mt-1 text-sm text-slate-500">{{ t('tech.subtitle') }}</p>
    </header>

    <p v-if="showIosHint" class="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-100">
      {{ t('push.installIos') }}
    </p>
    <div v-else-if="showEnablePush" class="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-100">
      <p>{{ pushDenied ? t('push.denied') : t('push.enableHint') }}</p>
      <Button v-if="!pushDenied" variant="outline" size="sm" class="mt-2" @click="requestPush">
        {{ t('push.enable') }}
      </Button>
    </div>

    <PageTabs v-if="deptTabs.length > 1" v-model="selectedDept" :tabs="deptTabs" />

    <p v-if="error && !invoiceOpen && !payOpen" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      {{ error }}
    </p>

    <div v-if="loading" class="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500 dark:border-slate-700">
      {{ t('tech.loading') }}
    </div>

    <div v-else-if="!hasDepartments" class="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center dark:border-slate-600">
      <span class="mx-auto flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
        <Wrench class="size-5" />
      </span>
      <p class="mt-3 font-medium">{{ t('tech.noDeptTitle') }}</p>
      <p class="mt-1 text-sm text-slate-500">{{ t('tech.noDept') }}</p>
    </div>

    <div v-else-if="missing" class="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center dark:border-slate-600">
      <span class="mx-auto flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
        <Wrench class="size-5" />
      </span>
      <p class="mt-3 font-medium">{{ t('tech.noneTitle') }}</p>
      <p class="mt-1 text-sm text-slate-500">{{ t('tech.none') }}</p>
    </div>

    <article v-else-if="job" class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700">
      <header class="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
        <div class="min-w-0">
          <p class="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">{{ t('tech.jobNumber', { id: job.id }) }}</p>
          <template v-if="!jobLocked">
            <h2 class="mt-1 truncate text-xl font-semibold">{{ job.client?.name }}</h2>
            <p v-if="job.department || job.contract" class="mt-1 text-xs text-slate-500">
              <span v-if="job.department">{{ departmentName(job.department) }}</span>
              <span v-if="job.department && job.contract"> · </span>
              <span v-if="job.contract">{{ t('tech.contract') }} {{ named('contractType', job.contract.type) }} #{{ job.contract.id }}</span>
            </p>
          </template>
          <p v-else class="mt-1 text-sm text-slate-500">{{ t('tech.acceptToSee') }}</p>
        </div>
        <StatusBadge :status="job.status" />
      </header>

      <ol class="grid grid-cols-3 border-b border-slate-200 bg-slate-50/80 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/40">
        <li v-for="(step, i) in steps" :key="step.label" class="flex flex-col items-center gap-1.5 text-center">
          <span
            class="flex size-6 items-center justify-center rounded-full text-[11px] font-semibold"
            :class="i < stepIndex
              ? 'bg-accent text-white'
              : i === stepIndex
                ? 'bg-accent text-white ring-4 ring-accent/15'
                : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'"
          >
            <Check v-if="i < stepIndex" class="size-3.5" />
            <template v-else>{{ i + 1 }}</template>
          </span>
          <span class="text-[11px] font-medium" :class="i <= stepIndex ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'">
            {{ step.label }}
          </span>
        </li>
      </ol>

      <div v-if="!jobLocked" class="border-b border-slate-200 px-5 py-3 dark:border-slate-700">
        <ConversationActions type="order" :id="job.id" />
      </div>

      <div class="space-y-5 p-5">
        <section v-if="!jobLocked">
          <p class="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">{{ t('tech.site') }}</p>
          <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <p class="text-sm font-medium">{{ job.location?.label || t('common.location') }}</p>
            <p v-if="job.location?.address" class="mt-0.5 text-sm leading-relaxed text-slate-500">{{ job.location.address }}</p>
            <a
              v-if="mapsLink"
              :href="mapsLink"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-transparent dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <MapPin class="size-4 text-accent" />
              {{ t('tech.openMaps') }}
            </a>
          </div>
        </section>

        <section v-if="!jobLocked && contactPhone && phoneDigits(contactPhone)">
          <p class="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">{{ t('tech.contact') }}</p>
          <div class="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-700">
            <p class="min-w-0 truncate text-sm font-medium tabular-nums">{{ formatPhone(contactPhone) }}</p>
            <PhoneActions :phone="contactPhone" icon-class="size-4" gap-class="gap-2" />
          </div>
        </section>

        <section v-if="!jobLocked && job.notes">
          <p class="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">{{ t('common.notes') }}</p>
          <p class="rounded-lg border-s-2 border-accent/70 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700 dark:bg-slate-800/50 dark:text-slate-200">
            {{ job.notes }}
          </p>
        </section>

        <section v-if="!jobLocked && machines.length">
          <p class="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">{{ t('tech.machines') }}</p>
          <ul class="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
            <li v-for="m in machines" :key="m.id" class="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
              <span class="font-medium">{{ machineLabel(m) }}</span>
              <span v-if="m.serial" class="text-xs text-slate-400">{{ m.serial }}</span>
            </li>
          </ul>
        </section>

        <div class="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800 md:static md:border-0 md:pt-4">
          <div class="fixed inset-x-0 bottom-16 z-10 border-t border-slate-200 bg-white/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:static md:inset-auto md:border-0 md:bg-transparent md:p-0 md:backdrop-none dark:border-slate-700 dark:bg-[#151c2c]/95">
          <Button v-if="primaryAction" size="lg" class="w-full" :loading="acting" @click="runPrimary">
            <component :is="primaryAction.icon" class="size-4" />
            {{ acting ? actingLabel : primaryAction.label }}
          </Button>
          <div v-if="showCreateInvoice || showEditInvoice || showCollect" class="mt-2 grid grid-cols-2 gap-2">
            <Button v-if="showCreateInvoice" variant="outline" size="lg" :disabled="acting" @click="openInvoice">
              <FileText class="size-4" />
              {{ t('tech.createInvoice') }}
            </Button>
            <Button v-if="showEditInvoice" variant="outline" size="lg" :disabled="acting" @click="openInvoice">
              <FileText class="size-4" />
              {{ t('tech.editInvoice') }}
            </Button>
            <Button v-if="showCollect" variant="outline" size="lg" :disabled="acting" @click="openPay">
              <Wallet class="size-4" />
              {{ t('tech.collect') }}
            </Button>
          </div>
          </div>
          <div class="h-28 md:hidden" aria-hidden="true" />
        </div>
      </div>
    </article>

    <section v-if="!auth.isFieldTech() && !loading && queue.length" class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700">
      <div class="border-b border-slate-200 px-5 py-3 dark:border-slate-700">
        <p class="text-sm font-medium">{{ t('tech.upNext') }}</p>
        <p class="text-xs text-slate-400">{{ t('tech.upNextHint') }}</p>
      </div>
      <ul class="divide-y divide-slate-100 dark:divide-slate-800">
        <li v-for="row in queue" :key="row.id" class="flex items-start justify-between gap-3 px-5 py-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium">#{{ row.id }} {{ row.client }}</p>
            <p class="truncate text-xs text-slate-500">{{ row.location || t('common.dash') }}</p>
          </div>
          <StatusBadge :status="row.status" />
        </li>
      </ul>
    </section>

    <section v-if="!jobLocked && !loading && jobInvoices.length" class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700">
      <div
        v-for="invoice in jobInvoices"
        :key="invoice.id"
        class="border-b border-slate-200 last:border-b-0 dark:border-slate-700"
      >
        <div class="flex items-center justify-between gap-3 px-5 py-3">
          <div>
            <p class="text-sm font-medium">{{ t('common.invoice') }} #{{ invoice.id }}</p>
            <p class="text-xs text-slate-500">
              {{ named('invoiceStatus', invoice.status) }}
              <span v-if="invoice.status === 'draft'"> · {{ t('tech.invoiceDraft') }}</span>
            </p>
          </div>
          <div class="flex items-center gap-2">
            <p class="text-sm font-semibold tabular-nums">{{ invoice.total }}</p>
            <DeleteButton
              v-if="invoice.status === 'draft' && auth.can('invoices.delete')"
              @click="askDeleteInvoice(invoice)"
            />
          </div>
        </div>
        <table v-if="invoice.items?.length" class="data-table">
          <thead><tr><th>{{ t('common.item') }}</th><th class="text-end">{{ t('common.qty') }}</th></tr></thead>
          <tbody>
            <tr v-for="line in invoice.items" :key="line.id">
              <td>{{ lineName(line) }}</td>
              <td class="text-end tabular-nums">{{ line.quantity }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="invoice.report" class="border-t border-slate-200 px-5 py-3 dark:border-slate-700">
          <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">{{ t('tech.report') }}</p>
          <p class="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">{{ invoice.report }}</p>
        </div>
      </div>
    </section>

    <section v-if="!loading && pendingIncoming.length" class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700">
      <div class="flex items-center gap-2 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
        <Package class="size-4 text-slate-400" />
        <div>
          <p class="text-sm font-medium">{{ t('tech.incomingTransfers') }}</p>
          <p class="text-xs text-slate-400">{{ pendingIncoming.length }}</p>
        </div>
      </div>
      <ul class="divide-y divide-slate-100 dark:divide-slate-800">
        <li v-for="xfer in pendingIncoming" :key="xfer.id" class="flex items-start justify-between gap-3 px-5 py-3">
          <div class="min-w-0">
            <p class="text-sm font-medium">#{{ xfer.id }} · {{ xfer.from_warehouse?.name }}</p>
            <p class="mt-0.5 truncate text-xs text-slate-500">{{ transferLineSummary(xfer) }}</p>
          </div>
          <Button v-if="auth.can('transfers.receive')" size="sm" :disabled="receiving" @click="askReceive(xfer)">
            {{ t('tech.confirmReceive') }}
          </Button>
        </li>
      </ul>
    </section>

    <section v-if="!loading && vanStock.length" class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700">
      <div class="flex items-center gap-2 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
        <Package class="size-4 text-slate-400" />
        <div>
          <p class="text-sm font-medium">{{ t('tech.vanStock') }}</p>
          <p class="text-xs text-slate-400">{{ vanStock.length }}</p>
        </div>
      </div>
      <table class="data-table">
        <thead><tr><th>{{ t('tech.sku') }}</th><th>{{ t('common.item') }}</th><th class="text-end">{{ t('common.qty') }}</th></tr></thead>
        <tbody>
          <tr v-for="row in vanStock" :key="row.id">
            <td class="font-medium">{{ row.sku }}</td>
            <td>{{ row.item }}</td>
            <td class="text-end tabular-nums">{{ fmtQty(row.qty) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <FormDialog
      v-model:open="invoiceOpen"
      :title="draftInvoice ? t('tech.editInvoice') : t('tech.invoiceQty')"
      :description="t('tech.invoiceDesc')"
      :submit-label="draftInvoice ? t('tech.saveInvoice') : t('tech.submitInvoice')"
      :error="error"
      :loading="saving"
      @submit="submitInvoice"
    >
      <InvoiceLinesEditor
        v-model="lines"
        :catalog="items"
        :machines="locationMachines"
        :covered-machine-ids="coveredMachineIds"
        :has-contract="!!job?.contract"
        :includes-spare-parts="!!job?.contract?.includes_spare_parts || job?.contract?.type === 'warranty'"
        :item-label="itemLabel"
      />
      <Field :label="t('tech.report')">
        <textarea v-model="report" class="textarea min-h-28" required :placeholder="t('tech.reportPh')" />
      </Field>
    </FormDialog>

    <ReceivePaymentDialog
      v-model:open="payOpen"
      :client-id="job?.client_id ?? null"
      :wallet="Number(job?.client?.wallet || 0)"
      :dues="techDues"
      :preset="payPreset"
      @saved="onPaid"
    />

    <ConfirmDialog
      v-model:open="deleteOpen"
      :title="t('invoices.deleteTitle')"
      :description="t('invoices.deleteDesc')"
      :confirm-label="t('common.delete')"
      variant="destructive"
      :loading="confirming"
      @confirm="deleteInvoice"
    />

    <ConfirmDialog
      v-model:open="receiveOpen"
      :title="t('tech.incomingTransfers')"
      :description="t('tech.receiveTransfer')"
      :confirm-label="t('tech.confirmReceive')"
      :loading="receiving"
      @confirm="confirmReceive"
    />
  </div>
</template>
