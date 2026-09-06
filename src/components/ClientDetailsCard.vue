<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { personName } from '@/i18n'
import { formatPhone } from '@/lib/phone'
import { cn } from '@/lib/utils'
import NetDueMark from '@/components/NetDueMark.vue'

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
</script>

<template>
  <article :class="cn('panel p-4', props.class)">
    <div class="mb-2.5 flex items-start justify-between gap-3">
      <p class="text-sm font-semibold">{{ client.name }}</p>
      <div class="flex shrink-0 items-center gap-2" @click.stop>
        <slot name="actions" />
      </div>
    </div>

    <dl
      :class="netDue > 0
        ? 'grid grid-cols-[10.5rem_minmax(0,1fr)_5.75rem] items-start gap-x-6 gap-y-2'
        : 'grid grid-cols-[10.5rem_minmax(0,1fr)] items-start gap-x-6 gap-y-2'"
    >
      <div class="min-w-0">
        <dt class="text-[0.7rem] font-medium tracking-wider text-slate-500 uppercase">{{ t('clients.phone') }}</dt>
        <dd class="mt-0.5 ms-0 text-sm">
          <p v-if="!phones.length">{{ t('common.dash') }}</p>
          <p v-for="(phone, idx) in phones" :key="idx">{{ phone }}</p>
        </dd>
      </div>
      <div class="min-w-0">
        <dt class="text-[0.7rem] font-medium tracking-wider text-slate-500 uppercase">{{ t('clients.locations') }}</dt>
        <dd class="mt-0.5 ms-0 text-sm">
          <p v-if="!locations.length">{{ t('common.dash') }}</p>
          <div v-else class="space-y-2">
            <div v-for="loc in locations" :key="loc.id || loc.label">
              <p class="font-medium">{{ loc.label || t('common.location') }}</p>
              <p v-if="loc.address" class="mt-0.5 text-xs leading-relaxed text-slate-500">
                {{ loc.address }}
              </p>
            </div>
          </div>
          <p class="mt-1 text-xs text-slate-400">
            {{ t('clients.machinesSites', { machines: machineCount, sites: locations.length }) }}
          </p>
        </dd>
      </div>
      <div v-if="netDue > 0" class="min-w-0">
        <NetDueMark :amount="netDue" />
      </div>
    </dl>
    <p v-if="client.creator" class="mt-2 text-xs text-slate-500">
      {{ t('common.createdBy') }} {{ personName(client.creator) }}
    </p>

    <p
      v-if="client.notes"
      class="mt-3 rounded-lg border-s-[3px] border-accent bg-slate-50 px-3 py-2 text-sm leading-relaxed dark:bg-slate-800/50"
    >
      {{ client.notes }}
    </p>
  </article>
</template>
