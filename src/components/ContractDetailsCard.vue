<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { named, personName, departmentName } from '@/i18n'
import { formatPhone } from '@/lib/phone'
import { contractRef } from '@/lib/contract'
import { cn, fmtDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import NetDueMark from '@/components/NetDueMark.vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  contract: any
  class?: string
}>()

const { t } = useI18n()
const auth = useAuthStore()

const phones = computed(() =>
  (props.contract.client?.phones || []).map((p: any) => formatPhone(p)).filter(Boolean).join(', '),
)

function yesNo(value: boolean | number | null | undefined) {
  return value ? t('common.yes') : t('common.no')
}

function statusBadgeClass(status?: string) {
  if (status === 'active') return 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
  if (status === 'expired') return 'border-transparent bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200'
  return ''
}

const netDue = computed(() => Number(props.contract.net_due || 0))
</script>

<template>
  <article :class="cn('panel p-5', props.class)">
    <div class="mb-4 flex items-start justify-between gap-3">
      <p class="text-sm font-semibold">{{ contractRef(contract) }}</p>
      <div class="flex shrink-0 flex-wrap items-center justify-end gap-2" @click.stop>
        <Badge variant="outline">{{ named('contractType', contract.type) }}</Badge>
        <Badge variant="secondary" :class="statusBadgeClass(contract.status)">{{ named('contractStatus', contract.status) }}</Badge>
        <slot name="actions" />
      </div>
    </div>

    <div
      :class="netDue > 0
        ? 'grid grid-cols-[minmax(0,1fr)_5.75rem] items-start gap-x-6'
        : ''"
    >
    <dl class="meta-grid min-w-0">
      <div>
        <dt>{{ t('common.client') }}</dt>
        <dd>
          <RouterLink
            v-if="auth.can('clients.view') && contract.client_id"
            :to="`/clients/${contract.client_id}`"
            class="text-accent hover:underline"
            @click.stop
          >
            {{ contract.client?.name }}
          </RouterLink>
          <span v-else>{{ contract.client?.name || t('common.dash') }}</span>
          <p v-if="phones" dir="ltr" class="phone-num mt-0.5 text-sm text-slate-500">{{ phones }}</p>
        </dd>
      </div>
      <div>
        <dt>{{ t('common.location') }}</dt>
        <dd>
          <p class="font-medium">{{ contract.location?.label || t('common.dash') }}</p>
          <p v-if="contract.location?.address" class="mt-0.5 text-xs leading-relaxed text-slate-500">
            {{ contract.location.address }}
          </p>
        </dd>
      </div>
      <div>
        <dt>{{ t('common.department') }}</dt>
        <dd>{{ departmentName(contract.department) }}</dd>
      </div>
      <div>
        <dt>{{ t('contracts.period') }}</dt>
        <dd class="tabular-nums">{{ fmtDate(contract.start_date) }} – {{ fmtDate(contract.end_date) }}</dd>
      </div>
      <div>
        <dt>{{ t('contracts.contractValue') }}</dt>
        <dd>
          <p class="tabular-nums">{{ contract.total_amount }}</p>
          <p class="mt-0.5 text-xs text-slate-500">
            {{ contract.payment_count }} {{ t('contracts.installments') }}
            ·
            {{ contract.planned_visits }} {{ t('contracts.plannedVisits') }}
          </p>
        </dd>
      </div>
      <div>
        <dt>{{ t('contracts.spareParts') }}</dt>
        <dd>{{ yesNo(contract.type === 'warranty' || contract.includes_spare_parts) }}</dd>
      </div>
      <div>
        <dt>{{ t('contracts.compressor') }}</dt>
        <dd>
          <p>{{ yesNo(contract.includes_compressor_warranty) }}</p>
          <p
            v-if="contract.includes_compressor_warranty"
            class="mt-0.5 text-xs tabular-nums text-slate-500"
          >
            {{ fmtDate(contract.compressor_warranty_start) }} – {{ fmtDate(contract.compressor_warranty_end) }}
          </p>
        </dd>
      </div>
      <div v-if="contract.creator">
        <dt>{{ t('common.createdBy') }}</dt>
        <dd>{{ personName(contract.creator) }}</dd>
      </div>
    </dl>
    <NetDueMark :amount="netDue" />
    </div>

    <dl v-if="$slots.more" class="meta-grid mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
      <slot name="more" />
    </dl>
    <slot />
  </article>
</template>
