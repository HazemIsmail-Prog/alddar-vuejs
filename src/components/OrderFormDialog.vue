<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import { apiError } from '@/lib/utils'
import { named, departmentName } from '@/i18n'
import { Input } from '@/components/ui/input'
import Field from '@/components/ui/Field.vue'
import FormDialog from '@/components/FormDialog.vue'
import ClientPicker, { type ClientRecord } from '@/components/ClientPicker.vue'
import { formatPhone } from '@/lib/phone'
import { useAuthStore } from '@/stores/auth'
import { useModalsStore } from '@/stores/modals'

const { t } = useI18n()
const auth = useAuthStore()
const modals = useModalsStore()
const selectedClient = ref<ClientRecord | null>(null)
const departments = ref<any[]>([])
const contracts = ref<any[]>([])
const error = ref('')
const saving = ref(false)
const form = ref(blankForm())

const clientLocked = computed(() => !!modals.orderForm.client)
const locations = computed(() => selectedClient.value?.locations ?? [])
const phones = computed(() => selectedClient.value?.phones ?? [])

function defaultPhoneId(client: ClientRecord | null) {
  const rows = client?.phones || []
  const primary = rows.find((p) => p.is_primary && p.id)
  return String((primary ?? rows[0])?.id || '')
}

const open = computed({
  get: () => modals.orderForm.open,
  set: (value) => {
    if (!value) modals.closeOrder()
  },
})

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function blankForm() {
  return { client_id: '' as number | '', phone_id: '', location_id: '', department_id: '', contract_id: '', planned_date: todayKey(), notes: '' }
}

async function ensureDepartments() {
  if (departments.value.length) return
  departments.value = (await api.get('/api/departments', { params: { is_service: 1 } })).data
}

function onClient(client: ClientRecord | null) {
  selectedClient.value = client
  form.value.location_id = ''
  form.value.contract_id = ''
  form.value.phone_id = defaultPhoneId(client)
  contracts.value = []
  if (client?.locations?.length === 1 && client.locations[0]) {
    form.value.location_id = String(client.locations[0].id)
    void onLocation()
  }
}

async function onLocation() {
  if (!form.value.location_id) {
    contracts.value = []
    return
  }
  if (!auth.can('contracts.view')) {
    contracts.value = []
    return
  }
  try {
    const { data } = await api.get('/api/contracts', { params: { location_id: form.value.location_id } })
    contracts.value = data.filter((x: any) => x.status === 'active')
  } catch {
    contracts.value = []
  }
}

function start(client?: ClientRecord | null) {
  error.value = ''
  form.value = blankForm()
  selectedClient.value = null
  contracts.value = []
  void ensureDepartments()
  if (client) {
    form.value.client_id = client.id
    onClient(client)
  }
}

async function create() {
  if (saving.value) return
  error.value = ''
  if (!form.value.client_id) {
    error.value = t('orders.selectClient')
    return
  }
  saving.value = true
  try {
    const { data } = await api.post('/api/orders', {
      client_id: Number(form.value.client_id),
      phone_id: Number(form.value.phone_id),
      location_id: Number(form.value.location_id),
      department_id: Number(form.value.department_id),
      contract_id: form.value.contract_id ? Number(form.value.contract_id) : null,
      planned_date: form.value.planned_date,
      notes: form.value.notes,
    })
    modals.closeOrder()
    modals.notifySaved('order', data.id)
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}

watch(
  () => [modals.orderForm.token, modals.orderForm.open] as const,
  ([token, isOpen]) => {
    if (!isOpen || !token) return
    start(modals.orderForm.client)
  },
)
</script>

<template>
  <FormDialog
    v-model:open="open"
    :title="t('orders.createTitle')"
    :description="clientLocked ? t('clients.orderDesc') : t('orders.createDesc')"
    :submit-label="t('orders.createSubmit')"
    :error="error"
    :loading="saving"
    @submit="create"
  >
    <div class="field">
      <span>{{ t('common.client') }}</span>
      <p v-if="clientLocked" class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
        {{ selectedClient?.name }}
      </p>
      <ClientPicker v-else v-model="form.client_id" @select="onClient" />
    </div>
    <Field :label="t('orders.contactPhone')">
      <select v-model="form.phone_id" class="select" required :disabled="!selectedClient">
        <option value="">{{ selectedClient ? (phones.length ? t('orders.selectPhone') : t('orders.noPhones')) : t('orders.selectClientFirst') }}</option>
        <option v-for="p in phones" :key="p.id" :value="String(p.id)">{{ formatPhone(p) }}</option>
      </select>
    </Field>
    <Field :label="t('common.location')">
      <select v-model="form.location_id" class="select" required :disabled="!selectedClient" @change="onLocation">
        <option value="">{{ selectedClient ? t('orders.selectLocation') : t('orders.selectClientFirst') }}</option>
        <option v-for="l in locations" :key="l.id" :value="l.id">{{ l.label }} — {{ l.address }}</option>
      </select>
    </Field>
    <Field :label="t('common.department')">
      <select v-model="form.department_id" class="select" required>
        <option value="">{{ t('orders.selectDepartment') }}</option>
        <option v-for="d in departments" :key="d.id" :value="d.id">{{ departmentName(d) }}</option>
      </select>
    </Field>
    <Field :label="t('orders.attachContract')">
      <select v-model="form.contract_id" class="select" :disabled="!form.location_id">
        <option value="">{{ t('orders.noBill') }}</option>
        <option v-for="c in contracts" :key="c.id" :value="c.id">{{ named('contractType', c.type) }} #{{ c.id }}</option>
      </select>
    </Field>
    <Field :label="t('contracts.plannedDate')">
      <Input v-model="form.planned_date" type="date" required />
    </Field>
    <Field :label="t('common.notes')"><Input v-model="form.notes" /></Field>
  </FormDialog>
</template>
