<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  VisArea,
  VisAxis,
  VisDonut,
  VisDonutSelectors,
  VisGroupedBar,
  VisGroupedBarSelectors,
  VisLine,
  VisSingleContainer,
  VisTooltip,
  VisXYContainer,
} from '@unovis/vue'
import { personName } from '@/i18n'
import { useThemeStore } from '@/stores/theme'
import {
  ChartContainer,
  ChartCrosshair,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  componentToString,
  type ChartConfig,
} from '@/components/ui/chart'
import { useStatusStore } from '@/stores/statuses'

type Activity = { date: string; orders: number; completed: number; collected: number }
type StatusRow = { status: string; count: number }
type TechRow = { id: number; name_en: string; name_ar: string; active_jobs: number }
type Ledger = { cash: number; ar: number; inventory: number; unearned: number; revenue: number; cogs: number; client_credit?: number }

const props = defineProps<{
  activity?: Activity[] | null
  orderStatus?: StatusRow[] | null
  technicians?: TechRow[] | null
  accounting?: Ledger | null
}>()

const { t, locale } = useI18n()
const statuses = useStatusStore()
const theme = useThemeStore()
const dark = computed(() => theme.mode === 'dark')
const tipClass =
  "rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 shadow-sm dark:border-slate-600 dark:text-slate-100"

const activityData = computed(() =>
  (props.activity || []).map((row) => ({
    ...row,
    date: new Date(`${row.date}T00:00:00`),
  })),
)
type ActivityPoint = (typeof activityData.value)[number]

const activityConfig = computed(() => ({
  orders: { label: t('nav.orders'), color: dark.value ? '#2dd4bf' : '#0f766e' },
  completed: { label: statuses.label('completed'), color: dark.value ? '#38bdf8' : '#0ea5e9' },
  collected: { label: t('clients.collected'), color: dark.value ? '#fbbf24' : '#f59e0b' },
}) satisfies ChartConfig)

const showCollected = computed(() => (props.activity || []).some((row) => row.collected > 0))

const statusData = computed(() => {
  void locale.value
  return (props.orderStatus || [])
    .filter((row) => row.count > 0)
    .map((row) => ({
      label: statuses.label(row.status),
      count: row.count,
      color: statuses.meta(row.status)?.color || '#94a3b8',
    }))
})
const statusTotal = computed(() => statusData.value.reduce((n, row) => n + row.count, 0))
const statusColors = computed(() => statusData.value.map((row) => row.color))
const statusConfig = computed(() =>
  Object.fromEntries(statusData.value.map((row, i) => [`s${i}`, { label: row.label, color: row.color }])) as ChartConfig,
)

const techData = computed(() =>
  (props.technicians || []).map((row) => {
    const label = personName(row)
    return {
      name: label.split(' ')[0] || label,
      jobs: row.active_jobs,
    }
  }),
)
type TechPoint = (typeof techData.value)[number]
const techConfig = computed(() => ({
  jobs: { label: t('dashboard.field'), color: dark.value ? '#2dd4bf' : '#0f766e' },
}) satisfies ChartConfig)

const booksData = computed(() => {
  const a = props.accounting
  if (!a) return []
  return [
    { name: t('dashboard.cash'), value: a.cash },
    { name: t('dashboard.receivables'), value: a.ar },
    { name: t('nav.inventory'), value: a.inventory },
    { name: t('dashboard.revenue'), value: a.revenue },
    { name: t('dashboard.unearned'), value: a.unearned },
    { name: t('dashboard.cogs'), value: a.cogs },
  ]
})
type BookPoint = (typeof booksData.value)[number]
const booksConfig = computed(() => ({
  value: { label: t('dashboard.balance'), color: dark.value ? '#2dd4bf' : '#0f766e' },
}) satisfies ChartConfig)

function dayTick(value: number) {
  return new Date(value).toLocaleDateString(locale.value === 'ar' ? 'ar' : 'en', { day: 'numeric', month: 'short' })
}

function moneyTick(value: number) {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 1000)}k`
  return String(value)
}
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-2">
    <section v-if="activityData.length" class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 lg:col-span-2">
      <h2 class="text-sm font-medium">{{ t('dashboard.charts.activity') }}</h2>
      <p class="mb-3 text-xs text-slate-500">{{ t('dashboard.charts.activityHint') }}</p>
      <ChartContainer :config="activityConfig" class="min-h-[220px]">
        <VisXYContainer :data="activityData">
          <VisArea
            :x="(d: ActivityPoint) => d.date"
            :y="(d: ActivityPoint) => d.orders"
            :color="activityConfig.orders.color"
            :opacity="0.18"
          />
          <VisLine
            :x="(d: ActivityPoint) => d.date"
            :y="(d: ActivityPoint) => d.orders"
            :color="activityConfig.orders.color"
          />
          <VisLine
            :x="(d: ActivityPoint) => d.date"
            :y="(d: ActivityPoint) => d.completed"
            :color="activityConfig.completed.color"
          />
          <VisLine
            v-if="showCollected"
            :x="(d: ActivityPoint) => d.date"
            :y="(d: ActivityPoint) => d.collected"
            :color="activityConfig.collected.color"
          />
          <VisAxis
            type="x"
            :x="(d: ActivityPoint) => d.date"
            :tick-line="false"
            :domain-line="false"
            :grid-line="false"
            :tick-format="dayTick"
            tick-text-color="#94a3b8"
          />
          <VisAxis
            type="y"
            :tick-line="false"
            :domain-line="false"
            :grid-line="true"
            tick-text-color="#94a3b8"
          />
          <ChartTooltip />
          <ChartCrosshair
            :template="componentToString(activityConfig, ChartTooltipContent, {
              labelFormatter: (d: unknown) => dayTick(d instanceof Date ? d.getTime() : Number(d)),
            })"
            :color="[activityConfig.orders.color, activityConfig.completed.color]"
          />
        </VisXYContainer>
        <ChartLegendContent />
      </ChartContainer>
    </section>

    <section v-if="statusData.length" class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700">
      <h2 class="text-sm font-medium">{{ t('dashboard.charts.orderMix') }}</h2>
      <p class="mb-3 text-xs text-slate-500">{{ t('dashboard.charts.orderMixHint') }}</p>
      <ChartContainer :config="statusConfig" class="min-h-[220px]">
        <VisSingleContainer :data="statusData">
          <VisDonut
            :value="(d: { count: number }) => d.count"
            :color="(_: unknown, i: number) => statusColors[i]"
            :arc-width="22"
            :show-background="false"
            :central-label="String(statusTotal)"
            :central-sub-label="t('nav.orders')"
          />
          <VisTooltip
            :triggers="{
              [VisDonutSelectors.segment]: (d: { data?: { label: string; count: number } }) => {
                const row = d?.data ?? d as { label?: string; count?: number }
                return `<div class='${tipClass}'>${row.label ?? ''}: <b>${row.count ?? 0}</b></div>`
              },
            }"
          />
        </VisSingleContainer>
        <ChartLegendContent />
      </ChartContainer>
    </section>

    <section v-if="techData.length" class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700">
      <h2 class="text-sm font-medium">{{ t('dashboard.charts.techLoad') }}</h2>
      <p class="mb-3 text-xs text-slate-500">{{ t('dashboard.charts.techLoadHint') }}</p>
      <ChartContainer :config="techConfig" class="min-h-[220px]">
        <VisXYContainer :data="techData">
          <VisGroupedBar
            :x="(d: TechPoint, i: number) => i"
            :y="(d: TechPoint) => d.jobs"
            :color="techConfig.jobs.color"
            :rounded-corners="4"
            :bar-padding="0.35"
          />
          <VisAxis
            type="x"
            :tick-line="false"
            :domain-line="false"
            :grid-line="false"
            :tick-format="(v: number) => techData[v]?.name || ''"
            tick-text-color="#94a3b8"
          />
          <VisAxis type="y" :tick-line="false" :domain-line="false" :grid-line="true" tick-text-color="#94a3b8" />
          <VisTooltip
            :triggers="{
              [VisGroupedBarSelectors.bar]: (d: TechPoint & { data?: TechPoint }) => {
                const row = d?.data ?? d
                return `<div class='${tipClass}'>${row.name}: <b>${row.jobs}</b></div>`
              },
            }"
          />
        </VisXYContainer>
      </ChartContainer>
    </section>

    <section v-if="booksData.length" class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700">
      <h2 class="text-sm font-medium">{{ t('dashboard.charts.books') }}</h2>
      <p class="mb-3 text-xs text-slate-500">{{ t('dashboard.charts.booksHint') }}</p>
      <ChartContainer :config="booksConfig" class="min-h-[220px]">
        <VisXYContainer :data="booksData">
          <VisGroupedBar
            :x="(d: BookPoint, i: number) => i"
            :y="(d: BookPoint) => d.value"
            :color="booksConfig.value.color"
            :rounded-corners="4"
            :bar-padding="0.25"
          />
          <VisAxis
            type="x"
            :tick-line="false"
            :domain-line="false"
            :grid-line="false"
            :tick-format="(v: number) => booksData[v]?.name || ''"
            tick-text-color="#94a3b8"
          />
          <VisAxis
            type="y"
            :tick-line="false"
            :domain-line="false"
            :grid-line="true"
            :tick-format="moneyTick"
            tick-text-color="#94a3b8"
          />
          <VisTooltip
            :triggers="{
              [VisGroupedBarSelectors.bar]: (d: BookPoint & { data?: BookPoint }) => {
                const row = d?.data ?? d
                return `<div class='${tipClass}'>${row.name}: <b>${Number(row.value).toLocaleString()}</b></div>`
              },
            }"
          />
        </VisXYContainer>
      </ChartContainer>
    </section>
  </div>
</template>
