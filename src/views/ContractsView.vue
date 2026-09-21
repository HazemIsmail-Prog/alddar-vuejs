<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { Plus, ScrollText, X } from '@lucide/vue'
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import { departmentName } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import PageHeader from '@/components/PageHeader.vue'
import PageTabs from '@/components/PageTabs.vue'
import EmptyState from '@/components/EmptyState.vue'
import LoadingState from '@/components/LoadingState.vue'
import ActionMenu from '@/components/ActionMenu.vue'
import FilterGroup from '@/components/FilterGroup.vue'
import FilterMulti from '@/components/FilterMulti.vue'
import FilterSelect from '@/components/FilterSelect.vue'
import FilterDateRange from '@/components/FilterDateRange.vue'
import ContractDetailsCard from '@/components/ContractDetailsCard.vue'
import ConversationActions from '@/components/ConversationActions.vue'
import PdfExportButton from '@/components/PdfExportButton.vue'
import { useAuthStore } from '@/stores/auth'
import { useModalsStore } from '@/stores/modals'
import { useInboxStore } from '@/stores/inbox'
import { usePdfStore } from '@/stores/pdf'

const emptyFilters = () => ({
  number: '',
  client_name: '',
  location: '',
  types: [] as string[],
  statuses: [] as string[],
  department_id: [] as number[],
  start_from: '',
  start_to: '',
  end_from: '',
  end_to: '',
  created_from: '',
  created_to: '',
  includes_spare_parts: 'all' as 'all' | '1' | '0',
  includes_compressor_warranty: 'all' as 'all' | '1' | '0',
})

const { t } = useI18n()
const auth = useAuthStore()
const modals = useModalsStore()
const inbox = useInboxStore()
const pdf = usePdfStore()
const { contractUnread } = storeToRefs(inbox)
const route = useRoute()
const router = useRouter()
const contracts = ref<any[]>([])
const departments = ref<any[]>([])
const filters = ref(emptyFilters())
const loading = ref(true)
const threadId = ref<number | null>(null)
const threadHost = ref<{ openComments: () => void; openFiles: () => void } | null>(null)
const tab = ref<'warranty' | 'annual'>('warranty')

const tabs = computed(() => [
  { id: 'warranty', label: t('contracts.warranty') },
  { id: 'annual', label: t('contracts.annual') },
])

watch(tab, (value) => {
  filters.value.types = [value]
})

const statusOptions = computed(() => [
  { value: 'active', label: t('contractStatus.active') },
  { value: 'expired', label: t('contractStatus.expired') },
  { value: 'cancelled', label: t('contractStatus.cancelled') },
])

const departmentOptions = computed(() =>
  departments.value.map((row) => ({ value: row.id, label: departmentName(row) })),
)

const yesNoOptions = computed(() => [
  { value: 'all', label: t('common.all') },
  { value: '1', label: t('common.yes') },
  { value: '0', label: t('common.no') },
])

const hasFilters = computed(() => {
  const f = filters.value
  return Boolean(
    f.number
    || f.client_name
    || f.location
    || f.statuses.length
    || f.department_id.length
    || f.start_from
    || f.start_to
    || f.end_from
    || f.end_to
    || f.created_from
    || f.created_to
    || f.includes_spare_parts !== 'all'
    || f.includes_compressor_warranty !== 'all',
  )
})

function filterParams() {
  const f = filters.value
  return {
    number: f.number || undefined,
    client_name: f.client_name || undefined,
    location: f.location || undefined,
    type: f.types.length ? f.types : undefined,
    status: f.statuses.length ? f.statuses : undefined,
    department_id: f.department_id.length ? f.department_id : undefined,
    start_from: f.start_from || undefined,
    start_to: f.start_to || undefined,
    end_from: f.end_from || undefined,
    end_to: f.end_to || undefined,
    created_from: f.created_from || undefined,
    created_to: f.created_to || undefined,
    includes_spare_parts: f.includes_spare_parts === 'all' ? undefined : f.includes_spare_parts,
    includes_compressor_warranty: f.includes_compressor_warranty === 'all' ? undefined : f.includes_compressor_warranty,
  }
}

async function load() {
  loading.value = true
  try {
    contracts.value = (await api.get('/api/contracts', { params: filterParams() })).data
  } finally {
    loading.value = false
  }
}

const searchNow = useDebounceFn(load, 250)
watch(filters, searchNow, { deep: true })
watch(() => modals.savedAt, () => {
  if (modals.savedKind === 'contract') void load()
})

function clearFilters() {
  filters.value = { ...emptyFilters(), types: [tab.value] }
}

function openRow(row: any) {
  void router.push(`/contracts/${row.id}`)
}

function rowActions(row: any) {
  const unread = contractUnread.value[row.id]
  return [
    {
      id: 'comments',
      label: unread ? `${t('comments.title')} (${unread})` : t('comments.title'),
    },
    { id: 'files', label: t('comments.files') },
    {
      id: 'edit',
      label: t('common.edit'),
      show: auth.can('contracts.update'),
    },
    { id: 'export', label: t('common.exportPdf') },
  ]
}

function onRowAction(row: any, id: string) {
  if (id === 'comments') void openConvo(row.id, 'comments')
  if (id === 'files') void openConvo(row.id, 'files')
  if (id === 'edit') modals.editContract(row.id)
  if (id === 'export') void exportContract(row.id)
}

async function exportList() {
  if (!contracts.value.length) return
  await pdf.print({
    kind: 'contract-list',
    title: t('pdf.contracts'),
    filename: 'contracts',
    data: { rows: contracts.value },
  })
}

async function exportContract(id: number) {
  const { data } = await api.get(`/api/contracts/${id}`)
  pdf.openContractPicker({
    title: t('pdf.contract', { id }),
    filename: `contract-${id}`,
    contract: data,
  })
}

async function openConvo(contractId: number, pane: 'comments' | 'files') {
  threadId.value = contractId
  await nextTick()
  if (pane === 'files') threadHost.value?.openFiles()
  else threadHost.value?.openComments()
}

onMounted(async () => {
  const id = Number(route.query.id)
  if (id) {
    await router.replace({ path: `/contracts/${id}`, hash: route.hash })
    return
  }
  departments.value = (await api.get('/api/departments', { params: { is_service: 1 } })).data
  await load()
  const clientId = Number(route.query.client)
  if (clientId && route.query.new === '1' && auth.can('contracts.create')) {
    await modals.createContractForClient(clientId)
    return
  }
  if (clientId) {
    const match = contracts.value.find((c: any) => c.client_id === clientId)
    if (match) await router.replace(`/contracts/${match.id}`)
  }
})
</script>

<template>
  <div>
    <PageHeader :title="t('contracts.title')" :subtitle="t('contracts.subtitle')">
      <template #actions>
        <PdfExportButton :disabled="!contracts.length" @click="exportList" />
        <Button v-if="auth.can('contracts.create')" @click="modals.createContract()">
          <Plus class="size-4" /> {{ t('contracts.newContract') }}
        </Button>
      </template>
    </PageHeader>

    <PageTabs v-model="tab" :tabs="tabs" class="mb-4" />

    <Card class="mb-4 p-3">
      <div class="flex flex-wrap items-start gap-x-6 gap-y-3">
        <FilterGroup :label="t('common.client')">
          <Input v-model="filters.client_name" class="h-8 w-40" :placeholder="t('orders.clientName')" />
        </FilterGroup>
        <FilterGroup :label="t('clients.groupSites')">
          <Input v-model="filters.location" class="h-8 w-48" :placeholder="t('clients.locationPh')" />
        </FilterGroup>
        <FilterGroup :label="t('contracts.groupContract')">
          <Input v-model="filters.number" class="h-8 w-28" :placeholder="t('contracts.numberPh')" inputmode="numeric" />
          <FilterMulti v-model="filters.statuses" :label="t('common.status')" :options="statusOptions" />
          <FilterMulti v-model="filters.department_id" :label="t('common.department')" :options="departmentOptions" />
        </FilterGroup>
        <FilterGroup :label="t('contracts.coverage')">
          <FilterSelect v-model="filters.includes_spare_parts" :label="t('contracts.spareParts')" :options="yesNoOptions" />
          <FilterSelect v-model="filters.includes_compressor_warranty" :label="t('contracts.compressor')" :options="yesNoOptions" />
        </FilterGroup>
        <FilterGroup :label="t('orders.groupDates')">
          <FilterDateRange v-model:from="filters.start_from" v-model:to="filters.start_to" :label="t('contracts.start')" />
          <FilterDateRange v-model:from="filters.end_from" v-model:to="filters.end_to" :label="t('contracts.end')" />
          <FilterDateRange v-model:from="filters.created_from" v-model:to="filters.created_to" :label="t('orders.createdDate')" />
        </FilterGroup>
        <div v-if="hasFilters" class="flex items-end self-end">
          <Button type="button" variant="ghost" size="sm" class="h-8" @click="clearFilters">
            <X class="size-3.5" /> {{ t('orders.clearFilters') }}
          </Button>
        </div>
      </div>
    </Card>

    <div class="relative">
      <LoadingState v-if="loading && !contracts.length" />
      <div v-else-if="contracts.length" class="space-y-3">
      <ContractDetailsCard
        v-for="c in contracts"
        :key="c.id"
        :contract="c"
        class="cursor-pointer transition-colors hover:border-slate-300 dark:hover:border-slate-500"
        @click="openRow(c)"
      >
        <template #actions>
          <div @click.stop>
            <ActionMenu
              :items="rowActions(c)"
              :badge="contractUnread[c.id]"
              @select="onRowAction(c, $event)"
            />
          </div>
        </template>
      </ContractDetailsCard>
      </div>
      <div v-else class="panel">
      <EmptyState
        :title="hasFilters ? t('common.noResults') : t('contracts.emptyTitle')"
        :description="hasFilters ? undefined : t('contracts.emptyHint')"
      >
        <template #icon><ScrollText class="size-5" /></template>
        <template v-if="auth.can('contracts.create') && !hasFilters" #action>
          <Button @click="modals.createContract()">
            <Plus class="size-4" /> {{ t('contracts.newContract') }}
          </Button>
        </template>
      </EmptyState>
      </div>
      <LoadingState v-if="loading && contracts.length" overlay />
    </div>

    <ConversationActions
      v-if="threadId"
      ref="threadHost"
      type="contract"
      :id="threadId"
      hide-buttons
      :follow-hash="false"
    />
  </div>
</template>
