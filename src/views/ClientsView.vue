<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { Plus, Users, X } from '@lucide/vue'
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import LoadingState from '@/components/LoadingState.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import ActionMenu from '@/components/ActionMenu.vue'
import FilterGroup from '@/components/FilterGroup.vue'
import FilterDateRange from '@/components/FilterDateRange.vue'
import ClientDetailsCard from '@/components/ClientDetailsCard.vue'
import ConversationActions from '@/components/ConversationActions.vue'
import { useAuthStore } from '@/stores/auth'
import { useModalsStore } from '@/stores/modals'
import { useInboxStore } from '@/stores/inbox'
import { useStaffReload } from '@/composables/useStaffEvent'

const emptyFilters = () => ({
  name: '',
  phone: '',
  location: '',
  created_from: '',
  created_to: '',
})

const { t } = useI18n()
const auth = useAuthStore()
const modals = useModalsStore()
const inbox = useInboxStore()
const { clientUnread } = storeToRefs(inbox)
const clients = ref<any[]>([])
const filters = ref(emptyFilters())
const route = useRoute()
const router = useRouter()
const page = ref(1)
const lastPage = ref(1)
const total = ref(0)
const loading = ref(true)
const threadId = ref<number | null>(null)
const threadHost = ref<{ openComments: () => void; openFiles: () => void } | null>(null)

const hasFilters = computed(() => {
  const f = filters.value
  return Boolean(f.name || f.phone || f.location || f.created_from || f.created_to)
})

function filterParams() {
  const f = filters.value
  return {
    name: f.name || undefined,
    phone: f.phone || undefined,
    location: f.location || undefined,
    created_from: f.created_from || undefined,
    created_to: f.created_to || undefined,
    page: page.value,
    per_page: 20,
  }
}

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/api/clients', { params: filterParams() })
    clients.value = data.data
    lastPage.value = data.last_page
    total.value = data.total
  } finally {
    loading.value = false
  }
}

const searchNow = useDebounceFn(() => {
  page.value = 1
  void load()
}, 250)

watch(filters, searchNow, { deep: true })
watch(() => modals.savedAt, () => {
  if (modals.savedKind === 'client' || modals.savedKind === 'client-deleted') void load()
})
watch(page, load)

useStaffReload((e) => e.kind === 'client' || e.kind === 'order', load)

function clearFilters() {
  filters.value = emptyFilters()
}

function openRow(client: any) {
  void router.push(`/clients/${client.id}`)
}

function rowActions(client: any) {
  const unread = clientUnread.value[client.id]
  return [
    {
      id: 'comments',
      label: unread ? `${t('comments.title')} (${unread})` : t('comments.title'),
    },
    { id: 'files', label: t('comments.files') },
    {
      id: 'order',
      label: t('clients.newOrder'),
      show: auth.can('orders.create'),
    },
    {
      id: 'edit',
      label: t('common.edit'),
      show: auth.can('clients.update'),
    },
  ]
}

function onRowAction(client: any, id: string) {
  if (id === 'comments') void openConvo(client.id, 'comments')
  if (id === 'files') void openConvo(client.id, 'files')
  if (id === 'edit') modals.editClient(client.id)
  if (id === 'order') {
    modals.createOrder({
      id: client.id,
      name: client.name,
      phones: client.phones,
      locations: client.locations,
    })
  }
}

async function openConvo(clientId: number, pane: 'comments' | 'files') {
  threadId.value = clientId
  await nextTick()
  if (pane === 'files') threadHost.value?.openFiles()
  else threadHost.value?.openComments()
}

onMounted(async () => {
  if (typeof route.query.q === 'string') filters.value.name = route.query.q
  await load()
  const id = Number(route.query.client)
  if (id) modals.editClient(id)
})
</script>

<template>
  <div>
    <PageHeader :title="t('clients.title')" :subtitle="t('clients.subtitle', { total })">
      <template #actions>
        <Button v-if="auth.can('clients.create')" @click="modals.createClient()">
          <Plus class="size-4" /> {{ t('clients.newClient') }}
        </Button>
      </template>
    </PageHeader>

    <Card class="mb-4 p-3">
      <div class="flex flex-wrap items-start gap-x-6 gap-y-3">
        <FilterGroup :label="t('common.client')">
          <Input v-model="filters.name" class="h-8 w-40" :placeholder="t('common.name')" />
          <Input v-model="filters.phone" class="h-8 w-36" :placeholder="t('clients.phone')" inputmode="tel" />
        </FilterGroup>
        <FilterGroup :label="t('clients.groupSites')">
          <Input v-model="filters.location" class="h-8 w-48" :placeholder="t('clients.locationPh')" />
        </FilterGroup>
        <FilterGroup :label="t('orders.groupDates')">
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
      <LoadingState v-if="loading && !clients.length" />
      <div v-else-if="clients.length" class="space-y-3">
        <ClientDetailsCard
          v-for="c in clients"
          :key="c.id"
          :client="c"
          class="cursor-pointer transition-colors hover:border-slate-300 dark:hover:border-slate-500"
          @click="openRow(c)"
        >
          <template #actions>
            <ActionMenu
              :items="rowActions(c)"
              :badge="clientUnread[c.id]"
              @select="onRowAction(c, $event)"
            />
          </template>
        </ClientDetailsCard>
      </div>
      <div v-else class="panel">
        <EmptyState
          :title="hasFilters ? t('common.noResults') : t('clients.emptyTitle')"
          :description="hasFilters ? undefined : t('clients.emptyHint')"
        >
          <template #icon><Users class="size-5" /></template>
          <template v-if="auth.can('clients.create') && !hasFilters" #action>
            <Button @click="modals.createClient()">
              <Plus class="size-4" /> {{ t('clients.newClient') }}
            </Button>
          </template>
        </EmptyState>
      </div>
      <LoadingState v-if="loading && clients.length" overlay />
    </div>

    <PaginationBar :page="page" :last-page="lastPage" @update:page="page = $event" />

    <ConversationActions
      v-if="threadId"
      ref="threadHost"
      type="client"
      :id="threadId"
      hide-buttons
      :follow-hash="false"
    />
  </div>
</template>
