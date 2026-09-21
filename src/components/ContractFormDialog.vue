<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, Check } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import { apiError } from '@/lib/utils'
import { contractRef } from '@/lib/contract'
import { named, departmentName } from '@/i18n'
import { Button } from '@/components/ui/button'
import DeleteButton from '@/components/DeleteButton.vue'
import { Input } from '@/components/ui/input'
import Field from '@/components/ui/Field.vue'
import FormDialog from '@/components/FormDialog.vue'
import ClientPicker, { type ClientRecord } from '@/components/ClientPicker.vue'
import { Switch } from '@/components/ui/switch'
import StatusBadge from '@/components/StatusBadge.vue'
import { useModalsStore } from '@/stores/modals'

const { t } = useI18n()
const modals = useModalsStore()
const selectedClient = ref<ClientRecord | null>(null)
const clientLocked = ref(false)
const departments = ref<any[]>([])
const editingId = ref<number | null>(null)
const editingLabel = ref('')
const financeLocked = ref(false)
const error = ref('')
const saving = ref(false)
const step = ref(1)
const lastStep = 3
let rowSeq = 0
const form = ref(blankForm())

const open = computed({
  get: () => modals.contractForm.open,
  set: (value) => {
    if (!value) modals.closeContract()
  },
})

function nextRowKey() {
  return ++rowSeq
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function addYears(iso: string, years: number) {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  d.setFullYear(d.getFullYear() + years)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function blankInstallment(due: string, amount: string, extra: Record<string, any> = {}) {
  return { key: nextRowKey(), id: null as number | null, due_date: due, amount, description: '', locked: false, ...extra }
}

function blankVisit(date: string, extra: Record<string, any> = {}) {
  return { key: nextRowKey(), id: null as number | null, planned_date: date, locked: false, sticky: false, status: undefined as string | undefined, ...extra }
}

function blankForm() {
  const start = new Date().toISOString().slice(0, 10)
  const end = addYears(start, 1)
  return {
    client_id: '' as number | '',
    location_id: '',
    department_id: '',
    reference_no: '',
    type: 'annual',
    includes_spare_parts: false,
    includes_compressor_warranty: false,
    start_date: start,
    end_date: end,
    total_amount: '1200',
    compressor_warranty_start: '',
    compressor_warranty_end: '',
    machine_ids: [] as number[],
    status: 'active',
    installments: [blankInstallment(start, '1200')],
    visits: [blankVisit(start)],
  }
}

const locations = computed(() => selectedClient.value?.locations ?? [])
const machines = computed(
  () => locations.value.find((l: any) => l.id === Number(form.value.location_id))?.machines ?? [],
)

async function ensureDepartments() {
  if (departments.value.length) return
  departments.value = (await api.get('/api/departments', { params: { is_service: 1 } })).data
}

function onClient(client: ClientRecord | null) {
  selectedClient.value = client
  if (!client) {
    form.value.location_id = ''
    form.value.machine_ids = []
    return
  }
  const locId = Number(form.value.location_id)
  const valid = client.locations?.some((l: any) => l.id === locId)
  if (!valid) {
    const only = client.locations?.[0]
    form.value.location_id = client.locations?.length === 1 && only ? String(only.id) : ''
    form.value.machine_ids = []
  }
}

function onLocationChange() {
  const valid = new Set(machines.value.map((m: any) => m.id))
  form.value.machine_ids = form.value.machine_ids.filter((id) => valid.has(id))
}

async function startCreate(client?: ClientRecord | null) {
  await ensureDepartments()
  editingId.value = null
  financeLocked.value = false
  clientLocked.value = !!client
  step.value = 1
  form.value = blankForm()
  selectedClient.value = null
  error.value = ''
  if (client) {
    form.value.client_id = client.id
    onClient(client)
  }
}

async function startEdit(row: any) {
  error.value = ''
  await ensureDepartments()
  const contract = (await api.get(`/api/contracts/${row.id}`)).data
  const client = (await api.get(`/api/clients/${contract.client_id}`)).data
  selectedClient.value = client
  clientLocked.value = false
  editingId.value = contract.id
  editingLabel.value = contractRef(contract)
  financeLocked.value = (contract.installments || []).some(
    (i: any) => i.status !== 'pending' || i.payments?.length,
  )
  step.value = 1
  form.value = {
    client_id: contract.client_id,
    location_id: String(contract.location_id),
    department_id: String(contract.department_id),
    reference_no: contract.reference_no || '',
    type: contract.type,
    includes_spare_parts: contract.type === 'warranty' ? true : !!contract.includes_spare_parts,
    includes_compressor_warranty: !!contract.includes_compressor_warranty,
    start_date: String(contract.start_date).slice(0, 10),
    end_date: String(contract.end_date).slice(0, 10),
    total_amount: String(contract.total_amount ?? '0'),
    compressor_warranty_start: contract.compressor_warranty_start
      ? String(contract.compressor_warranty_start).slice(0, 10)
      : '',
    compressor_warranty_end: contract.compressor_warranty_end
      ? String(contract.compressor_warranty_end).slice(0, 10)
      : '',
    machine_ids: (contract.machines || []).map((m: any) => m.id),
    status: contract.status === 'expired' ? 'active' : contract.status,
    installments: (contract.installments || []).map((i: any) =>
      blankInstallment(String(i.due_date).slice(0, 10), String(i.amount ?? '0'), {
        key: i.id,
        id: i.id,
        description: i.description || '',
        locked: i.status !== 'pending' || !!i.payments?.length,
      }),
    ),
    visits: (contract.orders || [])
      .filter((o: any) => o.source === 'contract_schedule' && o.status !== 'cancelled')
      .map((o: any) =>
        blankVisit(String(o.planned_date).slice(0, 10), {
          key: o.id,
          id: o.id,
          sticky: ['assigned', 'accepted', 'reached', 'completed'].includes(o.status),
          locked: ['accepted', 'reached', 'completed'].includes(o.status),
          status: o.status,
        }),
      ),
  }
}

function onType() {
  if (form.value.type === 'warranty') {
    form.value.total_amount = '0'
    form.value.installments = []
    form.value.includes_spare_parts = true
    form.value.includes_compressor_warranty = true
    fillCompressorDates()
    return
  }
  if (!form.value.installments.length) {
    form.value.installments = [blankInstallment(form.value.start_date, form.value.total_amount || '0')]
  }
}

function addInstallment() {
  const used = form.value.installments.reduce((n: number, i: any) => n + Number(i.amount || 0), 0)
  const leftover = Math.max(0, Number(form.value.total_amount || 0) - used)
  const last = form.value.installments.at(-1)?.due_date || form.value.start_date
  form.value.installments.push(blankInstallment(addDays(last, 30), String(Math.round(leftover))))
}

function removeInstallment(key: number) {
  if (form.value.installments.length <= 1) return
  form.value.installments = form.value.installments.filter((i: any) => i.key !== key)
}

function addVisit() {
  const last = form.value.visits.at(-1)?.planned_date || form.value.start_date
  form.value.visits.push(blankVisit(addDays(last, 90)))
}

function removeVisit(key: number) {
  form.value.visits = form.value.visits.filter((v: any) => v.key !== key)
}

const installmentSum = computed(() =>
  form.value.installments.reduce((n: number, i: any) => n + Number(i.amount || 0), 0),
)

function sumsMatch() {
  return Math.round(installmentSum.value) === Math.round(Number(form.value.total_amount || 0))
}

const wizardSteps = computed(() => [
  { id: 1, label: t('contracts.stepCustomer'), hint: t('contracts.stepCustomerHint') },
  { id: 2, label: t('contracts.stepTerms'), hint: t('contracts.stepTermsHint') },
  {
    id: 3,
    label: t('contracts.stepSchedule'),
    hint: form.value.type === 'warranty' ? t('contracts.stepScheduleWarrantyHint') : t('contracts.stepScheduleHint'),
  },
])

function toggleMachine(id: number) {
  const ids = form.value.machine_ids
  form.value.machine_ids = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
}

function onContractStartChange() {
  form.value.end_date = addYears(form.value.start_date, 1)
}

function onCompressorStartChange() {
  form.value.compressor_warranty_end = addYears(form.value.compressor_warranty_start, 5)
}

function fillCompressorDates() {
  form.value.compressor_warranty_start = form.value.start_date
  form.value.compressor_warranty_end = addYears(form.value.start_date, 5)
}

function toggleCompressor() {
  if (form.value.type === 'warranty') return
  form.value.includes_compressor_warranty = !form.value.includes_compressor_warranty
}

watch(
  () => form.value.includes_compressor_warranty,
  (on) => {
    if (on && !form.value.compressor_warranty_start && !form.value.compressor_warranty_end) {
      fillCompressorDates()
    }
  },
)

function setType(type: 'annual' | 'warranty') {
  if (financeLocked.value || form.value.type === type) return
  form.value.type = type
  onType()
}

function selectAllMachines() {
  form.value.machine_ids = machines.value.map((m: any) => m.id)
}

function clearMachines() {
  form.value.machine_ids = []
}

function validateStep(n: number) {
  error.value = ''
  if (n === 1) {
    if (!form.value.client_id) {
      error.value = t('contracts.selectClient')
      return false
    }
    if (!form.value.location_id || !form.value.department_id) {
      error.value = t('contracts.selectSite')
      return false
    }
  }
  if (n === 2) {
    if (!form.value.start_date || !form.value.end_date) {
      error.value = t('contracts.needPeriod')
      return false
    }
    if (form.value.includes_compressor_warranty && (!form.value.compressor_warranty_start || !form.value.compressor_warranty_end)) {
      error.value = t('contracts.needCompressorDates')
      return false
    }
  }
  if (n === 3) {
    if (form.value.installments.some((i: any) => !i.due_date || i.amount === '') || form.value.visits.some((v: any) => !v.planned_date)) {
      error.value = t('contracts.needDates')
      return false
    }
    if (form.value.type === 'annual' && !sumsMatch()) {
      error.value = t('contracts.amountsTotal', {
        sum: String(Math.round(installmentSum.value)),
        value: String(Math.round(Number(form.value.total_amount || 0))),
      })
      return false
    }
  }
  return true
}

function nextStep() {
  if (!validateStep(step.value)) return
  if (step.value < lastStep) step.value += 1
}

function prevStep() {
  error.value = ''
  if (step.value > 1) step.value -= 1
}

function goStep(n: number) {
  if (n === step.value) return
  if (n < step.value) {
    error.value = ''
    step.value = n
    return
  }
  for (let i = step.value; i < n; i++) {
    if (!validateStep(i)) return
  }
  step.value = n
}

function onWizardSubmit() {
  if (step.value < lastStep) {
    nextStep()
    return
  }
  save()
}

function payload() {
  return {
    client_id: Number(form.value.client_id),
    location_id: Number(form.value.location_id),
    department_id: Number(form.value.department_id),
    reference_no: String(form.value.reference_no).trim() || null,
    type: form.value.type,
    status: form.value.status,
    includes_spare_parts: form.value.type === 'warranty' ? true : form.value.includes_spare_parts,
    includes_compressor_warranty: form.value.includes_compressor_warranty,
    start_date: form.value.start_date,
    end_date: form.value.end_date,
    total_amount: Number(form.value.total_amount),
    compressor_warranty_start: form.value.includes_compressor_warranty
      ? form.value.compressor_warranty_start || form.value.start_date
      : null,
    compressor_warranty_end: form.value.includes_compressor_warranty ? form.value.compressor_warranty_end : null,
    machine_ids: form.value.machine_ids,
    installments:
      form.value.type === 'annual'
        ? form.value.installments.map((i: any) => ({
            ...(i.id ? { id: i.id } : {}),
            due_date: i.due_date,
            amount: Number(i.amount),
            description: i.description || null,
          }))
        : [],
    visits: form.value.visits.map((v: any) => ({
      ...(v.id ? { id: v.id } : {}),
      planned_date: v.planned_date,
    })),
  }
}

async function save() {
  if (saving.value) return
  if (!validateStep(1)) {
    step.value = 1
    return
  }
  if (!validateStep(2)) {
    step.value = 2
    return
  }
  if (!validateStep(3)) {
    step.value = 3
    return
  }
  saving.value = true
  try {
    let id = editingId.value
    if (editingId.value) {
      await api.put(`/api/contracts/${editingId.value}`, payload())
    } else {
      const { data } = await api.post('/api/contracts', payload())
      id = data.id
    }
    modals.closeContract()
    modals.notifySaved('contract', id)
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}

watch(
  () => [modals.contractForm.token, modals.contractForm.open] as const,
  async ([token, isOpen]) => {
    if (!isOpen || !token) return
    if (modals.contractForm.editId) await startEdit({ id: modals.contractForm.editId })
    else await startCreate(modals.contractForm.client)
  },
)
</script>

<template>
  <FormDialog
    v-model:open="open"
    :title="editingId ? t('contracts.editTitle', { id: editingLabel }) : t('contracts.createTitle')"
    :description="wizardSteps[step - 1]?.hint"
    wide
    :error="error"
    :loading="saving"
    @submit="onWizardSubmit"
  >
    <template #header-extra>
      <ol class="mt-4 flex items-center gap-0">
        <li v-for="(s, i) in wizardSteps" :key="s.id" class="flex min-w-0 items-center" :class="i < wizardSteps.length - 1 && 'flex-1'">
          <button
            type="button"
            class="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1.5 text-start transition sm:px-2"
            :class="step === s.id ? 'bg-teal-50 dark:bg-teal-950/40' : 'hover:bg-slate-50 dark:hover:bg-white/5'"
            :aria-current="step === s.id ? 'step' : undefined"
            @click="goStep(s.id)"
          >
            <span
              class="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              :class="step === s.id
                ? 'bg-accent text-white'
                : step > s.id
                  ? 'bg-accent/15 text-accent'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800'"
            >
              <Check v-if="step > s.id" class="size-3.5" />
              <span v-else>{{ s.id }}</span>
            </span>
            <span class="min-w-0">
              <span
                class="block max-w-[4.5rem] truncate text-xs font-medium sm:max-w-none sm:text-sm"
                :class="step === s.id ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'"
              >{{ s.label }}</span>
            </span>
          </button>
          <span
            v-if="i < wizardSteps.length - 1"
            class="mx-2 hidden h-px flex-1 sm:block"
            :class="step > s.id ? 'bg-accent' : 'bg-slate-200 dark:bg-slate-700'"
          />
        </li>
      </ol>
    </template>

    <div v-if="step === 1" class="grid min-h-[18rem] gap-4">
      <section class="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <p class="mb-3 text-sm font-medium">{{ t('contracts.selectClient') }}</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field sm:col-span-2">
            <span>{{ t('common.client') }}</span>
            <p v-if="clientLocked" class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
              {{ selectedClient?.name }}
            </p>
            <ClientPicker v-else v-model="form.client_id" @select="onClient" />
          </div>
          <Field :label="t('common.location')">
            <select v-model="form.location_id" class="select" required :disabled="!selectedClient" @change="onLocationChange">
              <option value="">{{ selectedClient ? t('orders.selectLocation') : t('orders.selectClientFirst') }}</option>
              <option v-for="l in locations" :key="l.id" :value="l.id">{{ l.label }} — {{ l.address }}</option>
            </select>
          </Field>
          <Field :label="t('common.department')">
            <select v-model="form.department_id" class="select" required>
              <option value="">{{ t('contracts.select') }}</option>
              <option v-for="d in departments" :key="d.id" :value="d.id">{{ departmentName(d) }}</option>
            </select>
          </Field>
          <div class="field sm:col-span-2">
            <span>{{ t('contracts.numberPh') }}</span>
            <Input v-model="form.reference_no" type="text" :placeholder="t('contracts.referenceNoPh')" />
          </div>
        </div>
      </section>
      <section class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <div class="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-slate-700">
          <div>
            <p class="text-sm font-medium">{{ t('contracts.coveredMachines') }}</p>
            <p class="text-xs text-slate-500">{{ t('contracts.machinesSelected', { n: form.machine_ids.length }) }}</p>
          </div>
          <div v-if="machines.length" class="flex gap-1">
            <Button type="button" size="sm" variant="ghost" @click="selectAllMachines">{{ t('contracts.selectAll') }}</Button>
            <Button type="button" size="sm" variant="ghost" @click="clearMachines">{{ t('contracts.clearAll') }}</Button>
          </div>
        </div>
        <div v-if="!form.location_id" class="px-3 py-8 text-center text-sm text-slate-400">{{ t('contracts.selectSite') }}</div>
        <div v-else-if="!machines.length" class="px-3 py-8 text-center text-sm text-slate-400">{{ t('contracts.noMachines') }}</div>
        <div v-else class="grid gap-1 p-2 sm:grid-cols-2">
          <label
            v-for="m in machines"
            :key="m.id"
            class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5"
            :class="form.machine_ids.includes(m.id) && 'bg-teal-50/70 dark:bg-teal-950/30'"
            @click.prevent="toggleMachine(m.id)"
          >
            <Switch class="pointer-events-none" :model-value="form.machine_ids.includes(m.id)" />
            <span class="min-w-0 truncate">{{ [m.brand, m.model, m.serial].filter(Boolean).join(' ') || t('clients.machine') }}</span>
          </label>
        </div>
      </section>
    </div>

    <div v-else-if="step === 2" class="grid min-h-[18rem] gap-4">
      <section>
        <p class="mb-2 text-sm font-medium">{{ t('common.type') }}</p>
        <div class="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            class="rounded-xl border p-3.5 text-start transition"
            :class="form.type === 'annual' ? 'border-accent bg-teal-50/70 ring-1 ring-accent/20 dark:bg-teal-950/30' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'"
            :disabled="financeLocked"
            @click="setType('annual')"
          >
            <span class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium">{{ t('contracts.annual') }}</span>
              <Check v-if="form.type === 'annual'" class="size-4 text-accent" />
            </span>
            <span class="mt-1 block text-xs leading-relaxed text-slate-500">{{ t('contracts.typeAnnualHint') }}</span>
          </button>
          <button
            type="button"
            class="rounded-xl border p-3.5 text-start transition"
            :class="form.type === 'warranty' ? 'border-accent bg-teal-50/70 ring-1 ring-accent/20 dark:bg-teal-950/30' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'"
            :disabled="financeLocked"
            @click="setType('warranty')"
          >
            <span class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium">{{ t('contracts.warranty') }}</span>
              <Check v-if="form.type === 'warranty'" class="size-4 text-accent" />
            </span>
            <span class="mt-1 block text-xs leading-relaxed text-slate-500">{{ t('contracts.typeWarrantyHint') }}</span>
          </button>
        </div>
      </section>
      <section class="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <p class="mb-3 text-sm font-medium">{{ t('contracts.period') }}</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <Field :label="t('contracts.start')"><Input v-model="form.start_date" type="date" required @change="onContractStartChange" /></Field>
          <Field :label="t('contracts.end')"><Input v-model="form.end_date" type="date" required /></Field>
          <Field :label="t('contracts.contractValue')">
            <Input v-model="form.total_amount" type="number" :disabled="form.type === 'warranty' || financeLocked" min="0" step="1" />
            <p v-if="form.type === 'warranty'" class="text-xs font-normal text-slate-500">{{ t('contracts.warrantyValueHint') }}</p>
          </Field>
          <Field v-if="editingId" :label="t('common.status')">
            <select v-model="form.status" class="select">
              <option value="active">{{ named('contractStatus', 'active') }}</option>
              <option value="cancelled">{{ named('contractStatus', 'cancelled') }}</option>
            </select>
          </Field>
        </div>
      </section>
      <section>
        <p class="mb-2 text-sm font-medium">{{ t('contracts.coverage') }}</p>
        <div class="grid gap-2 sm:grid-cols-2">
          <label
            class="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 p-3.5 dark:border-slate-700"
            :class="form.type === 'warranty' && 'cursor-default opacity-80'"
            @click.prevent="form.type !== 'warranty' && (form.includes_spare_parts = !form.includes_spare_parts)"
          >
            <span class="text-sm font-medium">{{ t('contracts.spareParts') }}</span>
            <Switch v-model="form.includes_spare_parts" :disabled="form.type === 'warranty'" />
          </label>
          <label
            class="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 p-3.5 dark:border-slate-700"
            :class="form.type === 'warranty' && 'cursor-default opacity-80'"
            @click.prevent="toggleCompressor()"
          >
            <span class="text-sm font-medium">{{ t('contracts.compressor') }}</span>
            <Switch v-model="form.includes_compressor_warranty" :disabled="form.type === 'warranty'" />
          </label>
        </div>
      </section>
      <section v-if="form.includes_compressor_warranty" class="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-700">
        <Field :label="t('contracts.compressorStart')"><Input v-model="form.compressor_warranty_start" type="date" @change="onCompressorStartChange" /></Field>
        <Field :label="t('contracts.compressorEnd')"><Input v-model="form.compressor_warranty_end" type="date" /></Field>
      </section>
      <p v-if="financeLocked" class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{{ t('contracts.billedLocked') }}</p>
    </div>

    <div v-else class="grid min-h-[18rem] gap-4">
      <section v-if="form.type === 'annual'" class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <div class="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-slate-700">
          <div>
            <p class="text-sm font-medium">{{ t('contracts.installments') }}</p>
            <p class="text-xs" :class="sumsMatch() ? 'text-slate-500' : 'text-amber-700 dark:text-amber-300'">
              {{ t('contracts.amountsTotal', { sum: Math.round(installmentSum), value: Math.round(Number(form.total_amount || 0)) }) }}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            :disabled="form.installments.length > 0 && form.installments.every((i: any) => i.locked)"
            @click="addInstallment"
          >
            <Plus class="size-3.5" /> {{ t('contracts.addInstallment') }}
          </Button>
        </div>
        <div class="hidden grid-cols-[minmax(0,1fr)_7rem_minmax(0,1.3fr)_2rem] gap-2 px-3 py-2 text-[11px] font-medium tracking-wide text-slate-400 uppercase sm:grid">
          <span>{{ t('contracts.due') }}</span>
          <span>{{ t('contracts.amount') }}</span>
          <span>{{ t('contracts.description') }}</span>
          <span />
        </div>
        <div
          v-for="(row, idx) in form.installments"
          :key="row.key"
          class="grid gap-2 border-t border-slate-100 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1.3fr)_2rem] sm:items-center dark:border-slate-800"
        >
          <p class="text-[11px] font-medium text-slate-400 sm:hidden">{{ t('contracts.installmentN', { n: idx + 1 }) }}</p>
          <Input v-model="row.due_date" type="date" required :disabled="row.locked" :aria-label="t('contracts.due')" />
          <Input v-model="row.amount" type="number" min="0" step="1" required :disabled="row.locked" :aria-label="t('contracts.amount')" />
          <Input v-model="row.description" :placeholder="t('contracts.descriptionPh')" maxlength="255" :aria-label="t('contracts.description')" />
          <DeleteButton
            icon-only
            class="justify-self-end sm:justify-self-center"
            :disabled="row.locked || form.installments.length <= 1"
            @click="removeInstallment(row.key)"
          />
        </div>
      </section>
      <p v-else class="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-700">
        {{ t('contracts.warrantyNoInstallments') }}
      </p>

      <section class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <div class="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-slate-700">
          <p class="text-sm font-medium">{{ t('contracts.plannedVisits') }}</p>
          <Button type="button" size="sm" variant="outline" @click="addVisit">
            <Plus class="size-3.5" /> {{ t('contracts.addVisit') }}
          </Button>
        </div>
        <div v-if="!form.visits.length" class="px-3 py-8 text-center text-sm text-slate-400">{{ t('contracts.none') }}</div>
        <div
          v-for="(row, idx) in form.visits"
          :key="row.key"
          class="flex items-center gap-2 border-t border-slate-100 px-3 py-2 dark:border-slate-800"
        >
          <span class="w-16 shrink-0 text-xs text-slate-400">{{ t('contracts.visitN', { n: idx + 1 }) }}</span>
          <Input v-model="row.planned_date" type="date" required :disabled="row.locked" class="flex-1" />
          <StatusBadge v-if="row.status" :status="row.status" />
          <DeleteButton
            icon-only
            :disabled="row.sticky"
            @click="removeVisit(row.key)"
          />
        </div>
      </section>
    </div>

    <template #footer>
      <Button variant="outline" type="button" :disabled="saving" @click="open = false">{{ t('common.cancel') }}</Button>
      <div class="flex gap-2">
        <Button v-if="step > 1" type="button" variant="outline" :disabled="saving" @click="prevStep">{{ t('common.back') }}</Button>
        <Button type="submit" :loading="saving">
          {{ step < lastStep ? t('contracts.continue') : (editingId ? t('contracts.editSubmit') : t('contracts.createSubmit')) }}
        </Button>
      </div>
    </template>
  </FormDialog>
</template>
