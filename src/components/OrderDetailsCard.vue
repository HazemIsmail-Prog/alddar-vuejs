<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { named, personName, departmentName } from '@/i18n'
import { formatPhone } from '@/lib/phone'
import { contractRef } from '@/lib/contract'
import { cn } from '@/lib/utils'
import StatusBadge from '@/components/StatusBadge.vue'
import NetDueMark from '@/components/NetDueMark.vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  order: any
  showId?: boolean
  class?: string
}>()

const { t } = useI18n()
const auth = useAuthStore()
const netDue = computed(() => Number(props.order.net_due || 0))
</script>

<template>
  <article :class="cn('panel p-5', props.class)">
    <div v-if="showId || $slots.actions" class="mb-4 flex items-start justify-between gap-3">
      <p v-if="showId" class="text-sm font-semibold">#{{ order.id }}</p>
      <span v-else />
      <div class="flex shrink-0 items-center gap-2">
        <StatusBadge v-if="showId" :status="order.status" />
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
            v-if="auth.can('clients.view') && order.client_id"
            :to="`/clients/${order.client_id}`"
            class="text-accent hover:underline"
            @click.stop
          >
            {{ order.client?.name }}
          </RouterLink>
          <span v-else>{{ order.client?.name || t('common.dash') }}</span>
        </dd>
      </div>
      <div>
        <dt>{{ t('common.location') }}</dt>
        <dd>
          <p class="font-medium">{{ order.location?.label || t('common.dash') }}</p>
          <p v-if="order.location?.address" class="mt-0.5 text-xs leading-relaxed text-slate-500">
            {{ order.location.address }}
          </p>
        </dd>
      </div>
      <div>
        <dt>{{ t('orders.contactPhone') }}</dt>
        <dd dir="ltr" class="phone-num">{{ formatPhone(order.phone) || t('common.dash') }}</dd>
      </div>
      <div>
        <dt>{{ t('orders.assignedTo') }}</dt>
        <dd>{{ personName(order.technician, t('orders.unassigned')) }}</dd>
      </div>
      <div>
        <dt>{{ t('common.department') }}</dt>
        <dd>{{ departmentName(order.department) }}</dd>
      </div>
      <div v-if="order.contract">
        <dt>{{ t('orders.contract') }}</dt>
        <dd>
          <RouterLink
            v-if="auth.can('contracts.view')"
            :to="`/contracts/${order.contract.id}`"
            class="text-accent hover:underline"
            @click.stop
          >
            {{ named('contractType', order.contract.type) }} {{ contractRef(order.contract) }}
          </RouterLink>
          <span v-else>{{ named('contractType', order.contract.type) }} {{ contractRef(order.contract) }}</span>
        </dd>
      </div>
      <div v-if="order.creator">
        <dt>{{ t('orders.createdBy') }}</dt>
        <dd>{{ personName(order.creator) }}</dd>
      </div>
    </dl>
    <NetDueMark :amount="netDue" />
    </div>

    <p
      v-if="order.notes"
      class="mt-4 rounded-lg border-s-[3px] border-accent bg-slate-50 px-3 py-2 text-sm leading-relaxed dark:bg-slate-800/50"
    >
      {{ order.notes }}
    </p>
  </article>
</template>
