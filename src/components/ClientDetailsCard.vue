<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { personName } from '@/i18n'
import { formatPhone } from '@/lib/phone'
import { cn, fmtDate } from '@/lib/utils'
import { daysUntilEnd } from '@/lib/contract'
import { Badge } from '@/components/ui/badge'

const props = defineProps<{
  client: any
  class?: string
}>()

const { t } = useI18n()

const phones = computed(() =>
  (props.client.phones || []).map((p: any) => formatPhone(p)).filter(Boolean),
)

const locations = computed(() => props.client.locations || [])
const machineCount = computed(() =>
  locations.value.reduce((n: number, loc: any) => n + (loc.machines?.length || 0), 0),
)

const netDue = computed(() => Number(props.client.net_due || 0))
const wallet = computed(() => Number(props.client.wallet || 0))
const outstanding = computed(() => Number(props.client.outstanding || 0))

const activeContracts = computed(() => (props.client.contracts || []).filter((c: any) => c.status === 'active'))
const hasValidContract = computed(() => activeContracts.value.length > 0)

const soonestEnd = computed(() => {
  let min: number | null = null
  for (const c of activeContracts.value) {
    const days = daysUntilEnd(c)
    if (days != null && (min == null || days < min)) min = days
  }

  return min
})

const nextExpiry = computed(() => {
  const [first] = [...activeContracts.value].sort((a: any, b: any) => String(a.end_date).localeCompare(String(b.end_date)))
  return first?.end_date || null
})
</script>

<template>
  <article :class="cn('panel p-4', props.class)">
    <div class="mb-3 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-sm font-semibold">{{ client.name }}</p>
        <div class="mt-1 flex flex-wrap items-center gap-1.5" @click.stop>
          <Badge
            v-if="hasValidContract"
            variant="outline"
            class="border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
          >{{ t('clients.hasValidContract') }}</Badge>
          <Badge
            v-if="soonestEnd != null && soonestEnd <= 30"
            variant="outline"
            class="border-transparent bg-amber-100 tabular-nums text-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
          >{{ soonestEnd }} {{ t('contracts.daysLeft') }}</Badge>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-2" @click.stop>
        <slot name="actions" />
      </div>
    </div>

    <dl class="meta-grid">
      <div>
        <dt>{{ t('clients.phones') }}</dt>
        <dd>
          <p v-if="!phones.length">{{ t('common.dash') }}</p>
          <p v-for="(phone, idx) in phones" :key="idx" dir="ltr" class="phone-num whitespace-nowrap">{{ phone }}</p>
        </dd>
      </div>
      <div>
        <dt>{{ t('clients.locations') }}</dt>
        <dd>
          <p v-if="!locations.length">{{ t('common.dash') }}</p>
          <div v-else class="space-y-2">
            <div v-for="loc in locations" :key="loc.id || loc.label">
              <p class="font-medium">{{ loc.label || t('common.location') }}</p>
              <p v-if="loc.address" class="mt-0.5 text-xs leading-relaxed text-slate-500">
                {{ loc.address }}
              </p>
            </div>
          </div>
        </dd>
      </div>
      <div>
        <dt>{{ t('clients.machines') }}</dt>
        <dd>{{ t('clients.machinesSites', { machines: machineCount, sites: locations.length }) }}</dd>
      </div>
      <div>
        <dt>{{ t('clients.activeContracts') }}</dt>
        <dd>
          <p v-if="!activeContracts.length">{{ t('common.dash') }}</p>
          <template v-else>
            <p class="tabular-nums">{{ activeContracts.length }}</p>
            <p v-if="nextExpiry" class="mt-0.5 text-xs tabular-nums text-slate-500">{{ t('clients.until') }} {{ fmtDate(nextExpiry) }}</p>
          </template>
        </dd>
      </div>
      <div>
        <dt>{{ t('clients.netDue') }}</dt>
        <dd class="tabular-nums" :class="netDue > 0 ? 'font-semibold text-amber-800 dark:text-amber-200' : ''">
          {{ netDue > 0 ? netDue : t('clients.settled') }}
        </dd>
      </div>
      <div>
        <dt>{{ t('clients.wallet') }}</dt>
        <dd class="tabular-nums">{{ wallet }}</dd>
      </div>
      <div>
        <dt>{{ t('clients.outstanding') }}</dt>
        <dd class="tabular-nums">{{ outstanding }}</dd>
      </div>
      <div v-if="client.creator">
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
      class="mt-3 rounded-lg border-s-[3px] border-accent bg-slate-50 px-3 py-2 text-sm leading-relaxed dark:bg-slate-800/50"
    >
      {{ client.notes }}
    </p>
  </article>
</template>
