<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Receipt } from '@lucide/vue'
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import { apiError } from '@/lib/utils'
import { named, personName } from '@/i18n'
import { invoiceCanDelete } from '@/lib/orderInvoices'
import { Badge } from '@/components/ui/badge'
import PageHeader from '@/components/PageHeader.vue'
import SearchField from '@/components/SearchField.vue'
import EmptyState from '@/components/EmptyState.vue'
import PageTabs from '@/components/PageTabs.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import ActionMenu from '@/components/ActionMenu.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PdfExportButton from '@/components/PdfExportButton.vue'
import { useAuthStore } from '@/stores/auth'
import { useStaffReload } from '@/composables/useStaffEvent'
import { usePdfStore } from '@/stores/pdf'

const { t } = useI18n()
const auth = useAuthStore()
const pdf = usePdfStore()
const router = useRouter()
const invoices = ref<any[]>([])
const search = ref('')
const status = ref('')
const page = ref(1)
const lastPage = ref(1)
const total = ref(0)
const loading = ref(true)
const exporting = ref(false)
const confirmOpen = ref(false)
const deleting = ref<any>(null)
const error = ref('')
const confirming = ref(false)

const tabs = [
  { id: '', labelKey: 'invoices.all' },
  { id: 'draft', labelKey: 'invoiceStatus.draft' },
  { id: 'confirmed', labelKey: 'invoiceStatus.confirmed' },
  { id: 'voided', labelKey: 'invoiceStatus.voided' },
]

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/api/invoices', {
      params: { search: search.value, status: status.value || undefined, page: page.value, per_page: 20 },
    })
    invoices.value = data.data
    lastPage.value = data.last_page
    total.value = data.total
  } finally {
    loading.value = false
  }
}

const searchNow = useDebounceFn(() => {
  page.value = 1
  load()
}, 250)

watch(search, searchNow)
watch(page, load)
watch(status, () => {
  page.value = 1
  load()
})

onMounted(load)

useStaffReload((e) => e.kind === 'order' || e.kind === 'client', load)

function rowActions(inv: any) {
  return [
    { id: 'open', label: t('common.open') },
    { id: 'export', label: t('common.exportPdf') },
    {
      id: 'delete',
      label: t('common.delete'),
      danger: true,
      show: auth.can('invoices.delete') && invoiceCanDelete(inv),
    },
  ]
}

function onRowAction(inv: any, id: string) {
  if (id === 'open') router.push(`/invoices/${inv.id}`)
  if (id === 'export') void exportInvoice(inv.id)
  if (id === 'delete') {
    deleting.value = inv
    confirmOpen.value = true
  }
}

async function exportList() {
  if (exporting.value || !total.value) return
  exporting.value = true
  error.value = ''
  try {
    const rows: any[] = []
    let next = 1
    let last = 1
    do {
      const { data } = await api.get('/api/invoices', {
        params: { search: search.value, status: status.value || undefined, page: next, per_page: 50 },
      })
      rows.push(...(data.data || []))
      last = data.last_page || 1
      next += 1
    } while (next <= last)
    await pdf.print({
      kind: 'invoice-list',
      title: t('pdf.invoices'),
      filename: 'invoices',
      data: { rows },
    })
  } catch (e) {
    error.value = apiError(e)
  } finally {
    exporting.value = false
  }
}

async function exportInvoice(id: number) {
  error.value = ''
  try {
    const { data } = await api.get(`/api/invoices/${id}`)
    await pdf.print({
      kind: 'invoice-detail',
      title: t('pdf.invoice', { id }),
      filename: `invoice-${id}`,
      data: { invoice: data },
    })
  } catch (e) {
    error.value = apiError(e)
  }
}

async function remove() {
  if (!deleting.value || confirming.value) return
  error.value = ''
  confirming.value = true
  try {
    await api.delete(`/api/invoices/${deleting.value.id}`)
    confirmOpen.value = false
    deleting.value = null
    await load()
  } catch (e) {
    error.value = apiError(e)
    confirmOpen.value = false
  } finally {
    confirming.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader :title="t('invoices.title')" :subtitle="t('invoices.subtitle', { total })">
      <template #actions>
        <PdfExportButton :disabled="!total" :loading="exporting" @click="exportList" />
        <SearchField v-model="search" :placeholder="t('invoices.clientName')" />
      </template>
    </PageHeader>

    <PageTabs :tabs="tabs.map((tab) => ({ id: tab.id, label: t(tab.labelKey) }))" v-model="status" />

    <p v-if="error" class="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      {{ error }}
    </p>

    <div class="panel">
      <table v-if="invoices.length" class="data-table">
        <thead>
          <tr>
            <th>{{ t('common.invoice') }}</th>
            <th>{{ t('common.client') }}</th>
            <th>{{ t('invoices.order') }}</th>
            <th>{{ t('common.technician') }}</th>
            <th>{{ t('common.status') }}</th>
            <th>{{ t('invoices.total') }}</th>
            <th class="w-12"><span class="sr-only">{{ t('common.details') }}</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="inv in invoices" :key="inv.id" class="table-row-link" @click="router.push(`/invoices/${inv.id}`)">
            <td class="font-medium">#{{ inv.id }}</td>
            <td :data-label="t('common.client')">
              <RouterLink
                v-if="inv.order?.client_id && auth.can('clients.view')"
                :to="`/clients/${inv.order.client_id}`"
                class="text-accent hover:underline"
                @click.stop
              >{{ inv.order?.client?.name }}</RouterLink>
              <span v-else>{{ inv.order?.client?.name }}</span>
            </td>
            <td :data-label="t('invoices.order')">
              <RouterLink :to="`/orders/${inv.order_id}`" class="text-accent hover:underline" @click.stop>#{{ inv.order_id }}</RouterLink>
            </td>
            <td :data-label="t('common.technician')">{{ personName(inv.order?.technician) }}</td>
            <td :data-label="t('common.status')"><Badge variant="secondary">{{ named('invoiceStatus', inv.status) }}</Badge></td>
            <td :data-label="t('invoices.total')" class="tabular-nums">{{ inv.total }}</td>
            <td @click.stop>
              <ActionMenu :items="rowActions(inv)" @select="onRowAction(inv, $event)" />
            </td>
          </tr>
        </tbody>
      </table>
      <EmptyState
        v-else-if="!loading"
        :title="search || status ? t('common.noResults') : t('invoices.emptyTitle')"
        :description="search || status ? undefined : t('invoices.emptyHint')"
      >
        <template #icon><Receipt class="size-5" /></template>
      </EmptyState>
    </div>

    <PaginationBar :page="page" :last-page="lastPage" @update:page="page = $event" />

    <ConfirmDialog
      v-model:open="confirmOpen"
      :title="t('invoices.deleteTitle')"
      :description="t('invoices.deleteDesc')"
      :confirm-label="t('common.delete')"
      variant="destructive"
      :loading="confirming"
      @confirm="remove"
    />
  </div>
</template>
