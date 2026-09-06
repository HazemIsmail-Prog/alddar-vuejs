<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  ClipboardList,
  LayoutGrid,
  Package,
  Plus,
  Receipt,
  ScrollText,
  UserCog,
  Users,
  Wrench,
} from '@lucide/vue'
import api from '@/api/client'
import { apiError } from '@/lib/utils'
import { named, personName, departmentName } from '@/i18n'
import { Button } from '@/components/ui/button'
import StatusBadge from '@/components/StatusBadge.vue'
import { useAuthStore } from '@/stores/auth'
import { useModalsStore } from '@/stores/modals'
import { useStatusStore } from '@/stores/statuses'
import DashboardCharts from '@/components/DashboardCharts.vue'
import PageHeader from '@/components/PageHeader.vue'

type Alert = { key: string; count: number; to: string }
type Dash = {
  alerts: Alert[]
  orders: null | {
    total: number
    open: number
    completed_today: number
    by_status: { status: string; count: number }[]
    recent: { id: number; status: string; client: string | null; client_id: number; technician: { id: number; name_en: string; name_ar: string } | null; location: string | null }[]
  }
  dispatch: null | { unassigned: number; held: number; in_field: number; technicians: { id: number; name_en: string; name_ar: string; active_jobs: number }[] }
  tech: null | {
    current: null | { id: number; status: string; client?: string | null; location?: string | null; notes?: string | null; department_id?: number | null }
    queue: number
    departments?: {
      id: number
      name_en?: string
      name_ar?: string
      current: { id: number; status: string; client?: string | null } | null
      queue: number
    }[]
  }
  clients: null | { total: number; new_month: number; locations: number; machines: number }
  contracts: null | { total: number; active: number; expiring_30: number; value: number; overdue_installments: number; installment_outstanding: number }
  invoices: null | { draft: number; confirmed: number; outstanding: number; collected_month: number; recent: { id: number; status: string; total: number; client: string | null }[] }
  inventory: null | { warehouses: number; skus_on_hand: number; out_of_stock: number; in_transit: number; draft_transfers: number; draft_adjustments: number; on_hand_value: number | null; own_only: boolean }
  accounting: null | { cash: number; ar: number; inventory: number; in_transit: number; unearned: number; revenue: number; cogs: number; client_credit?: number }
  staff: null | { active: number; inactive: number; departments: number }
  activity: null | { date: string; orders: number; completed: number; collected: number }[]
}

const { t, locale } = useI18n()
const auth = useAuthStore()
const modals = useModalsStore()
const statuses = useStatusStore()
const data = ref<Dash | null>(null)
const error = ref('')
const loading = ref(true)

async function load(quiet = false) {
  if (!quiet) {
    loading.value = true
    error.value = ''
  }
  try {
    data.value = (await api.get('/api/dashboard')).data
  } catch (e) {
    if (!quiet) error.value = apiError(e)
  } finally {
    if (!quiet) loading.value = false
  }
}

onMounted(() => { void load() })
watch(() => modals.savedAt, () => { void load(true) })

const hour = new Date().getHours()
const greeting = computed(() => {
  if (hour < 12) return t('dashboard.morning')
  if (hour < 17) return t('dashboard.afternoon')
  return t('dashboard.evening')
})
const todayLabel = computed(() =>
  new Date().toLocaleDateString(locale.value === 'ar' ? 'ar' : 'en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }),
)
const roleLabels = computed(() => (auth.user?.roles || []).map((role) => named('role', role)).join(', '))

function money(n?: number | null) {
  if (n == null) return t('common.dash')
  return Number(n).toLocaleString(locale.value === 'ar' ? 'ar' : 'en')
}

function statusColor(status: string) {
  return statuses.meta(status)?.color || '#94a3b8'
}

const orderTotal = computed(() =>
  (data.value?.orders?.by_status || []).reduce((n, row) => n + row.count, 0) || 1,
)

const kpis = computed(() => {
  const d = data.value
  if (!d) return []
  const rows: { label: string; value: string; hint?: string; to: string; warn?: boolean }[] = []
  if (d.tech?.current) {
    rows.push({
      label: t('dashboard.currentJob'),
      value: `#${d.tech.current.id}`,
      hint: d.tech.current.client || t('common.dash'),
      to: d.tech.current.department_id ? `/tech?department=${d.tech.current.department_id}` : '/tech',
    })
  }
  if (d.orders) {
    rows.push({
      label: t('dashboard.openOrders'),
      value: String(d.orders.open),
      hint: t('dashboard.completedToday', { n: d.orders.completed_today }),
      to: '/orders',
      warn: d.orders.open > 8,
    })
  }
  if (d.dispatch) {
    rows.push({
      label: t('dashboard.unassigned'),
      value: String(d.dispatch.unassigned),
      hint: t('dashboard.inField', { n: d.dispatch.in_field }),
      to: '/dispatch',
      warn: d.dispatch.unassigned > 0,
    })
  }
  if (d.contracts) {
    rows.push({
      label: t('dashboard.activeContracts'),
      value: String(d.contracts.active),
      hint: t('dashboard.contractValue', { n: money(d.contracts.value) }),
      to: '/contracts',
    })
  }
  if (d.invoices) {
    rows.push({
      label: t('dashboard.outstanding'),
      value: money(d.invoices.outstanding),
      hint: t('dashboard.collectedMonth', { n: money(d.invoices.collected_month) }),
      to: '/invoices',
      warn: d.invoices.outstanding > 0,
    })
  }
  if (d.accounting) {
    rows.push({
      label: t('dashboard.receivables'),
      value: money(d.accounting.ar),
      hint: t('dashboard.cashOnHand', { n: money(d.accounting.cash) }),
      to: '/accounting',
    })
  }
  if (d.clients && rows.length < 6) {
    rows.push({
      label: t('nav.clients'),
      value: String(d.clients.total),
      hint: t('dashboard.machinesSites', { machines: d.clients.machines, sites: d.clients.locations }),
      to: '/clients',
    })
  }
  if (d.inventory && rows.length < 6) {
    rows.push({
      label: d.inventory.own_only ? t('dashboard.vanStock') : t('nav.inventory'),
      value: d.inventory.on_hand_value != null ? money(d.inventory.on_hand_value) : String(d.inventory.skus_on_hand),
      hint: t('dashboard.outOfStock', { n: d.inventory.out_of_stock }),
      to: '/inventory',
      warn: d.inventory.out_of_stock > 0,
    })
  }
  return rows.slice(0, 6)
})
</script>

<template>
  <div>
    <PageHeader :title="`${greeting}, ${personName(auth.user)}`" :subtitle="`${roleLabels} · ${t('dashboard.subtitle')}`">
      <template #eyebrow>
        <p class="text-xs tracking-wide text-slate-400 uppercase">{{ todayLabel }}</p>
      </template>
      <template #actions>
        <Button v-if="auth.can('orders.create')" @click="modals.createOrder()">
          <Plus class="size-4" /> {{ t('clients.newOrder') }}
        </Button>
        <Button v-if="auth.can('contracts.create')" variant="outline" @click="modals.createContract()">
          <Plus class="size-4" /> {{ t('clients.newContract') }}
        </Button>
        <Button v-if="auth.can('clients.create')" variant="outline" @click="modals.createClient()">
          <Plus class="size-4" /> {{ t('clients.newClient') }}
        </Button>
      </template>
    </PageHeader>

    <div v-if="loading" class="text-sm text-slate-500">{{ t('dashboard.loading') }}</div>
    <div v-else-if="error" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      {{ error }}
    </div>
    <div v-else-if="data" class="space-y-6">
      <div v-if="data.alerts.length" class="flex flex-wrap gap-2">
        <RouterLink
          v-for="alert in data.alerts"
          :key="alert.key"
          :to="alert.to"
          class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 hover:border-amber-300 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <AlertTriangle class="size-3.5" />
          {{ t(`dashboard.alerts.${alert.key}`, { n: alert.count }) }}
        </RouterLink>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <RouterLink
          v-for="kpi in kpis"
          :key="kpi.label"
          :to="kpi.to"
          class="rounded-xl border bg-white p-4 transition hover:border-accent/40 dark:border-slate-700"
          :class="kpi.warn ? 'border-amber-300 dark:border-amber-800' : 'border-slate-200'"
        >
          <p class="text-xs text-slate-500">{{ kpi.label }}</p>
          <p class="mt-1 text-2xl font-semibold" :class="kpi.warn && 'text-amber-800 dark:text-amber-200'">{{ kpi.value }}</p>
          <p v-if="kpi.hint" class="mt-1 text-xs text-slate-400">{{ kpi.hint }}</p>
        </RouterLink>
      </div>

      <DashboardCharts
        :activity="data.activity"
        :order-status="data.orders?.by_status"
        :technicians="data.dispatch?.technicians"
        :accounting="data.accounting"
      />

      <div class="grid gap-4 lg:grid-cols-2">
        <section v-if="data.tech" class="rounded-xl border border-slate-200 bg-white dark:border-slate-700">
          <header class="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div class="flex items-center gap-2">
              <Wrench class="size-4 text-accent" />
              <h2 class="text-sm font-medium">{{ t('nav.myJob') }}</h2>
            </div>
            <RouterLink
              :to="data.tech.current?.department_id ? `/tech?department=${data.tech.current.department_id}` : '/tech'"
              class="inline-flex items-center gap-0.5 text-xs text-accent hover:underline"
            >
              {{ t('dashboard.open') }} <ArrowUpRight class="size-3" />
            </RouterLink>
          </header>
          <div class="p-4">
            <div v-if="(data.tech.departments || []).length > 1" class="space-y-3">
              <div v-for="dept in data.tech.departments" :key="dept.id" class="rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800">
                <RouterLink :to="`/tech?department=${dept.id}`" class="text-xs font-medium text-slate-500 hover:text-accent">
                  {{ departmentName(dept) }}
                </RouterLink>
                <div v-if="dept.current" class="mt-1 flex items-center justify-between gap-2">
                  <RouterLink :to="`/orders/${dept.current.id}`" class="truncate text-sm font-medium text-accent hover:underline">
                    #{{ dept.current.id }} {{ dept.current.client }}
                  </RouterLink>
                  <StatusBadge :status="dept.current.status" />
                </div>
                <p v-else class="mt-1 text-sm text-slate-400">{{ t('dashboard.noCurrentJob') }}</p>
                <p v-if="dept.queue" class="mt-1 text-xs text-slate-400">{{ t('dashboard.queueBehind', { n: dept.queue }) }}</p>
              </div>
            </div>
            <template v-else>
              <div v-if="data.tech.current" class="space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <RouterLink :to="`/orders/${data.tech.current.id}`" class="text-sm font-medium text-accent hover:underline">
                    #{{ data.tech.current.id }} {{ data.tech.current.client }}
                  </RouterLink>
                  <StatusBadge :status="data.tech.current.status" />
                </div>
                <p class="text-xs text-slate-500">{{ data.tech.current.location || t('common.dash') }}</p>
                <p v-if="data.tech.current.notes" class="text-sm text-slate-600 dark:text-slate-300">{{ data.tech.current.notes }}</p>
              </div>
              <p v-else class="text-sm text-slate-400">{{ t('dashboard.noCurrentJob') }}</p>
              <p class="mt-3 text-xs text-slate-400">{{ t('dashboard.queueBehind', { n: data.tech.queue }) }}</p>
            </template>
          </div>
        </section>

        <section v-if="data.orders" class="rounded-xl border border-slate-200 bg-white dark:border-slate-700">
          <header class="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div class="flex items-center gap-2">
              <ClipboardList class="size-4 text-accent" />
              <h2 class="text-sm font-medium">{{ t('nav.orders') }}</h2>
            </div>
            <RouterLink to="/orders" class="inline-flex items-center gap-0.5 text-xs text-accent hover:underline">
              {{ t('dashboard.viewAll') }} <ArrowUpRight class="size-3" />
            </RouterLink>
          </header>
          <div class="space-y-3 p-4">
            <div class="flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                v-for="row in data.orders.by_status"
                :key="row.status"
                class="h-full"
                :style="{ width: `${(row.count / orderTotal) * 100}%`, background: statusColor(row.status) }"
              />
            </div>
            <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
              <span v-for="row in data.orders.by_status.filter((r) => r.count)" :key="row.status" class="inline-flex items-center gap-1">
                <span class="size-1.5 rounded-full" :style="{ background: statusColor(row.status) }" />
                {{ statuses.label(row.status) }} {{ row.count }}
              </span>
            </div>
            <ul class="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              <li v-for="row in data.orders.recent" :key="row.id" class="flex items-center justify-between gap-2 py-2">
                <RouterLink :to="`/orders/${row.id}`" class="min-w-0 truncate text-accent hover:underline">
                  #{{ row.id }} {{ row.client }}
                </RouterLink>
                <StatusBadge :status="row.status" />
              </li>
              <li v-if="!data.orders.recent.length" class="py-2 text-slate-400">{{ t('orders.empty') }}</li>
            </ul>
          </div>
        </section>

        <section v-if="data.dispatch" class="rounded-xl border border-slate-200 bg-white dark:border-slate-700">
          <header class="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div class="flex items-center gap-2">
              <LayoutGrid class="size-4 text-accent" />
              <h2 class="text-sm font-medium">{{ t('nav.dispatch') }}</h2>
            </div>
            <RouterLink to="/dispatch" class="inline-flex items-center gap-0.5 text-xs text-accent hover:underline">
              {{ t('dashboard.open') }} <ArrowUpRight class="size-3" />
            </RouterLink>
          </header>
          <div class="grid grid-cols-3 gap-2 p-4">
            <div class="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-900">
              <p class="text-xl font-semibold">{{ data.dispatch.unassigned }}</p>
              <p class="text-[11px] text-slate-500">{{ t('dashboard.unassigned') }}</p>
            </div>
            <div class="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-900">
              <p class="text-xl font-semibold">{{ data.dispatch.held }}</p>
              <p class="text-[11px] text-slate-500">{{ t('dashboard.held') }}</p>
            </div>
            <div class="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-900">
              <p class="text-xl font-semibold">{{ data.dispatch.in_field }}</p>
              <p class="text-[11px] text-slate-500">{{ t('dashboard.field') }}</p>
            </div>
          </div>
          <ul class="border-t border-slate-100 px-4 py-2 text-sm dark:border-slate-800">
            <li v-for="tech in data.dispatch.technicians" :key="tech.id" class="flex justify-between py-1.5">
              <span>{{ personName(tech) }}</span>
              <span class="text-slate-500">{{ t('dashboard.jobsN', { n: tech.active_jobs }) }}</span>
            </li>
          </ul>
        </section>

        <section v-if="data.clients" class="rounded-xl border border-slate-200 bg-white dark:border-slate-700">
          <header class="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div class="flex items-center gap-2">
              <Users class="size-4 text-accent" />
              <h2 class="text-sm font-medium">{{ t('nav.clients') }}</h2>
            </div>
            <RouterLink to="/clients" class="inline-flex items-center gap-0.5 text-xs text-accent hover:underline">
              {{ t('dashboard.viewAll') }} <ArrowUpRight class="size-3" />
            </RouterLink>
          </header>
          <div class="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            <div>
              <p class="text-xl font-semibold">{{ data.clients.total }}</p>
              <p class="text-xs text-slate-500">{{ t('dashboard.total') }}</p>
            </div>
            <div>
              <p class="text-xl font-semibold">{{ data.clients.new_month }}</p>
              <p class="text-xs text-slate-500">{{ t('dashboard.newThisMonth') }}</p>
            </div>
            <div>
              <p class="text-xl font-semibold">{{ data.clients.locations }}</p>
              <p class="text-xs text-slate-500">{{ t('clients.locations') }}</p>
            </div>
            <div>
              <p class="text-xl font-semibold">{{ data.clients.machines }}</p>
              <p class="text-xs text-slate-500">{{ t('clients.machines') }}</p>
            </div>
          </div>
        </section>

        <section v-if="data.contracts" class="rounded-xl border border-slate-200 bg-white dark:border-slate-700">
          <header class="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div class="flex items-center gap-2">
              <ScrollText class="size-4 text-accent" />
              <h2 class="text-sm font-medium">{{ t('nav.contracts') }}</h2>
            </div>
            <RouterLink to="/contracts" class="inline-flex items-center gap-0.5 text-xs text-accent hover:underline">
              {{ t('dashboard.viewAll') }} <ArrowUpRight class="size-3" />
            </RouterLink>
          </header>
          <div class="grid grid-cols-2 gap-3 p-4">
            <div>
              <p class="text-xl font-semibold">{{ data.contracts.active }}</p>
              <p class="text-xs text-slate-500">{{ t('dashboard.active') }} / {{ data.contracts.total }}</p>
            </div>
            <div>
              <p class="text-xl font-semibold">{{ money(data.contracts.value) }}</p>
              <p class="text-xs text-slate-500">{{ t('contracts.value') }}</p>
            </div>
            <div :class="data.contracts.overdue_installments > 0 && 'text-amber-800 dark:text-amber-200'">
              <p class="text-xl font-semibold">{{ data.contracts.overdue_installments }}</p>
              <p class="text-xs text-slate-500">{{ t('dashboard.overdueInstallments') }}</p>
            </div>
            <div>
              <p class="text-xl font-semibold">{{ money(data.contracts.installment_outstanding) }}</p>
              <p class="text-xs text-slate-500">{{ t('clients.outstanding') }}</p>
            </div>
          </div>
        </section>

        <section v-if="data.invoices" class="rounded-xl border border-slate-200 bg-white dark:border-slate-700">
          <header class="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div class="flex items-center gap-2">
              <Receipt class="size-4 text-accent" />
              <h2 class="text-sm font-medium">{{ t('nav.invoices') }}</h2>
            </div>
            <RouterLink to="/invoices" class="inline-flex items-center gap-0.5 text-xs text-accent hover:underline">
              {{ t('dashboard.viewAll') }} <ArrowUpRight class="size-3" />
            </RouterLink>
          </header>
          <div class="grid grid-cols-3 gap-2 p-4">
            <div>
              <p class="text-xl font-semibold">{{ data.invoices.draft }}</p>
              <p class="text-xs text-slate-500">{{ t('dashboard.draft') }}</p>
            </div>
            <div>
              <p class="text-xl font-semibold">{{ money(data.invoices.outstanding) }}</p>
              <p class="text-xs text-slate-500">{{ t('dashboard.outstanding') }}</p>
            </div>
            <div>
              <p class="text-xl font-semibold">{{ money(data.invoices.collected_month) }}</p>
              <p class="text-xs text-slate-500">{{ t('dashboard.thisMonth') }}</p>
            </div>
          </div>
          <ul class="border-t border-slate-100 px-4 py-2 text-sm dark:border-slate-800">
            <li v-for="row in data.invoices.recent" :key="row.id" class="flex items-center justify-between gap-2 py-1.5">
              <RouterLink :to="`/invoices/${row.id}`" class="truncate text-accent hover:underline">
                #{{ row.id }} {{ row.client }}
              </RouterLink>
              <span class="shrink-0 text-slate-500">{{ money(row.total) }}</span>
            </li>
            <li v-if="!data.invoices.recent.length" class="py-1.5 text-slate-400">{{ t('invoices.empty') }}</li>
          </ul>
        </section>

        <section v-if="data.inventory" class="rounded-xl border border-slate-200 bg-white dark:border-slate-700">
          <header class="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div class="flex items-center gap-2">
              <Package class="size-4 text-accent" />
              <h2 class="text-sm font-medium">{{ data.inventory.own_only ? t('dashboard.vanStock') : t('nav.inventory') }}</h2>
            </div>
            <RouterLink to="/inventory" class="inline-flex items-center gap-0.5 text-xs text-accent hover:underline">
              {{ t('dashboard.open') }} <ArrowUpRight class="size-3" />
            </RouterLink>
          </header>
          <div class="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
            <div>
              <p class="text-xl font-semibold">{{ data.inventory.skus_on_hand }}</p>
              <p class="text-xs text-slate-500">{{ t('dashboard.skusOnHand') }}</p>
            </div>
            <div :class="data.inventory.out_of_stock > 0 && 'text-amber-800 dark:text-amber-200'">
              <p class="text-xl font-semibold">{{ data.inventory.out_of_stock }}</p>
              <p class="text-xs text-slate-500">{{ t('dashboard.outOfStockShort') }}</p>
            </div>
            <div v-if="data.inventory.on_hand_value != null">
              <p class="text-xl font-semibold">{{ money(data.inventory.on_hand_value) }}</p>
              <p class="text-xs text-slate-500">{{ t('dashboard.stockValue') }}</p>
            </div>
            <div>
              <p class="text-xl font-semibold">{{ data.inventory.in_transit }}</p>
              <p class="text-xs text-slate-500">{{ t('dashboard.inTransit') }}</p>
            </div>
            <div>
              <p class="text-xl font-semibold">{{ data.inventory.draft_transfers }}</p>
              <p class="text-xs text-slate-500">{{ t('dashboard.draftTransfers') }}</p>
            </div>
            <div>
              <p class="text-xl font-semibold">{{ data.inventory.draft_adjustments }}</p>
              <p class="text-xs text-slate-500">{{ t('dashboard.draftAdjustments') }}</p>
            </div>
          </div>
        </section>

        <section v-if="data.accounting" class="rounded-xl border border-slate-200 bg-white dark:border-slate-700">
          <header class="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div class="flex items-center gap-2">
              <BookOpen class="size-4 text-accent" />
              <h2 class="text-sm font-medium">{{ t('nav.accounting') }}</h2>
            </div>
            <RouterLink to="/accounting" class="inline-flex items-center gap-0.5 text-xs text-accent hover:underline">
              {{ t('dashboard.open') }} <ArrowUpRight class="size-3" />
            </RouterLink>
          </header>
          <div class="grid grid-cols-2 gap-3 p-4">
            <div>
              <p class="text-xl font-semibold">{{ money(data.accounting.cash) }}</p>
              <p class="text-xs text-slate-500">{{ t('dashboard.cash') }}</p>
            </div>
            <div>
              <p class="text-xl font-semibold">{{ money(data.accounting.ar) }}</p>
              <p class="text-xs text-slate-500">{{ t('dashboard.receivables') }}</p>
            </div>
            <div>
              <p class="text-xl font-semibold">{{ money(data.accounting.inventory) }}</p>
              <p class="text-xs text-slate-500">{{ t('nav.inventory') }}</p>
            </div>
            <div>
              <p class="text-xl font-semibold">{{ money(data.accounting.revenue) }}</p>
              <p class="text-xs text-slate-500">{{ t('dashboard.revenue') }}</p>
            </div>
            <div>
              <p class="text-xl font-semibold">{{ money(data.accounting.unearned) }}</p>
              <p class="text-xs text-slate-500">{{ t('dashboard.unearned') }}</p>
            </div>
            <div>
              <p class="text-xl font-semibold">{{ money(data.accounting.cogs) }}</p>
              <p class="text-xs text-slate-500">{{ t('dashboard.cogs') }}</p>
            </div>
          </div>
        </section>

        <section v-if="data.staff" class="rounded-xl border border-slate-200 bg-white dark:border-slate-700">
          <header class="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div class="flex items-center gap-2">
              <UserCog class="size-4 text-accent" />
              <h2 class="text-sm font-medium">{{ t('nav.staff') }}</h2>
            </div>
            <RouterLink to="/admin/users" class="inline-flex items-center gap-0.5 text-xs text-accent hover:underline">
              {{ t('dashboard.open') }} <ArrowUpRight class="size-3" />
            </RouterLink>
          </header>
          <div class="grid grid-cols-3 gap-3 p-4">
            <div>
              <p class="text-xl font-semibold">{{ data.staff.active }}</p>
              <p class="text-xs text-slate-500">{{ t('dashboard.activeStaff') }}</p>
            </div>
            <div>
              <p class="text-xl font-semibold">{{ data.staff.inactive }}</p>
              <p class="text-xs text-slate-500">{{ t('dashboard.inactiveStaff') }}</p>
            </div>
            <div>
              <p class="text-xl font-semibold">{{ data.staff.departments }}</p>
              <p class="text-xs text-slate-500">{{ t('dashboard.departments') }}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
