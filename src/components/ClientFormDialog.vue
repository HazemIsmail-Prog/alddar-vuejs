<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, Check } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import { addressComplete, blankAddress, locationPayload } from '@/lib/address'
import { blankPhoneInput, phonePayload } from '@/lib/phone'
import { apiError } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import DeleteButton from '@/components/DeleteButton.vue'
import { Input } from '@/components/ui/input'
import Field from '@/components/ui/Field.vue'
import FormDialog from '@/components/FormDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import AddressFields from '@/components/AddressFields.vue'
import { useAuthStore } from '@/stores/auth'
import { useModalsStore } from '@/stores/modals'

const { t } = useI18n()
const auth = useAuthStore()
const modals = useModalsStore()
const confirmOpen = ref(false)
const error = ref('')
const saving = ref(false)
const confirming = ref(false)
const busyKey = ref('')
const editing = ref<any>(null)
const newPhone = ref(blankPhoneInput())
const newLoc = ref({ label: 'المنزل', ...blankAddress() })
const machineDrafts = ref<Record<string, { brand: string; model: string; serial: string }>>({})
const step = ref(1)
const lastStep = 3
let tmpId = -1

const open = computed({
  get: () => modals.clientForm.open,
  set: (value) => {
    if (!value) modals.closeClient()
  },
})

function blankClient() {
  return { id: null as number | null, name: '', notes: '', phones: [] as any[], locations: [] as any[] }
}

function isSaved() {
  return Number(editing.value?.id) > 0
}

function nextTmp() {
  return tmpId--
}

function resetExtras() {
  newPhone.value = blankPhoneInput()
  newLoc.value = { label: 'المنزل', ...blankAddress() }
  machineDrafts.value = {}
  step.value = 1
}

function draftFor(locId: string | number) {
  const key = String(locId)
  if (!machineDrafts.value[key]) {
    machineDrafts.value[key] = { brand: '', model: '', serial: '' }
  }
  return machineDrafts.value[key]
}

function startCreate() {
  editing.value = blankClient()
  resetExtras()
  error.value = ''
  const phone = modals.clientForm.phone
  if (phone) newPhone.value = { ...blankPhoneInput(), phone }
}

async function startEdit(id: number) {
  error.value = ''
  resetExtras()
  editing.value = (await api.get(`/api/clients/${id}`)).data
}

async function refreshEditing() {
  if (!editing.value?.id) return
  editing.value = (await api.get(`/api/clients/${editing.value.id}`)).data
}

function createPhones() {
  const rows = [...(editing.value.phones || [])]
  if (newPhone.value.phone.trim()) {
    rows.push({ ...newPhone.value, is_primary: rows.length === 0 })
  }
  return rows.filter((p: any) => String(p.phone || '').trim()).map((p: any) => phonePayload(p))
}

function createLocations() {
  const rows = [...(editing.value.locations || [])]
  if (addressComplete(newLoc.value)) {
    rows.push(newLoc.value)
  }
  return rows.filter((l: any) => addressComplete(l)).map((l: any) => ({
    ...locationPayload(l),
    machines: (l.machines || []).map((m: any) => ({
      brand: m.brand,
      model: m.model,
      serial: m.serial,
      notes: m.notes,
    })),
  }))
}

async function withBusy(key: string, fn: () => Promise<void>) {
  if (busyKey.value) return
  busyKey.value = key
  error.value = ''
  try {
    await fn()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    busyKey.value = ''
  }
}

async function saveClient() {
  if (saving.value) return
  error.value = ''
  if (!validateStep(1)) {
    step.value = 1
    return
  }
  saving.value = true
  try {
    if (!isSaved()) {
      const { data } = await api.post('/api/clients', {
        name: editing.value.name,
        notes: editing.value.notes,
        phones: createPhones(),
        locations: createLocations(),
      })
      modals.closeClient()
      modals.notifySaved('client', data.id)
      return
    }
    await api.put(`/api/clients/${editing.value.id}`, {
      name: editing.value.name,
      notes: editing.value.notes,
    })
    const id = editing.value.id
    modals.closeClient()
    modals.notifySaved('client', id)
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}

async function addPhone() {
  if (!newPhone.value.phone.trim()) return
  error.value = ''
  if (!isSaved()) {
    editing.value.phones.push({
      id: nextTmp(),
      ...phonePayload({ ...newPhone.value, is_primary: editing.value.phones.length === 0 }),
    })
    newPhone.value = blankPhoneInput()
    return
  }
  await withBusy('phone:add', async () => {
    await api.post(`/api/clients/${editing.value.id}/phones`, phonePayload(newPhone.value))
    newPhone.value = blankPhoneInput()
    await refreshEditing()
  })
}

async function savePhone(phone: any) {
  if (!isSaved() || Number(phone.id) < 0) return
  await withBusy(`phone:${phone.id}`, async () => {
    await api.put(`/api/phones/${phone.id}`, phonePayload(phone))
    await refreshEditing()
  })
}

async function deletePhone(phone: any) {
  if (!isSaved() || Number(phone.id) < 0) {
    editing.value.phones = editing.value.phones.filter((p: any) => p.id !== phone.id)
    return
  }
  await withBusy(`phone-del:${phone.id}`, async () => {
    await api.delete(`/api/phones/${phone.id}`)
    await refreshEditing()
  })
}

async function addLocation() {
  if (!addressComplete(newLoc.value)) {
    error.value = t('clients.addressRequired')
    return
  }
  error.value = ''
  if (!isSaved()) {
    editing.value.locations.push({
      id: nextTmp(),
      ...locationPayload(newLoc.value),
      machines: [],
    })
    newLoc.value = { label: 'المنزل', ...blankAddress() }
    return
  }
  await withBusy('loc:add', async () => {
    await api.post(`/api/clients/${editing.value.id}/locations`, locationPayload(newLoc.value))
    newLoc.value = { label: 'المنزل', ...blankAddress() }
    await refreshEditing()
  })
}

async function saveLocation(loc: any) {
  if (!isSaved() || Number(loc.id) < 0) return
  if (!addressComplete(loc)) {
    error.value = t('clients.addressRequired')
    return
  }
  error.value = ''
  await withBusy(`loc:${loc.id}`, async () => {
    await api.put(`/api/locations/${loc.id}`, locationPayload(loc))
    await refreshEditing()
  })
}

async function deleteLocation(loc: any) {
  error.value = ''
  if (!isSaved() || Number(loc.id) < 0) {
    editing.value.locations = editing.value.locations.filter((l: any) => l.id !== loc.id)
    delete machineDrafts.value[String(loc.id)]
    return
  }
  await withBusy(`loc-del:${loc.id}`, async () => {
    await api.delete(`/api/locations/${loc.id}`)
    await refreshEditing()
  })
}

async function addMachine(loc: any) {
  const draft = draftFor(loc.id)
  if (!draft.brand.trim() && !draft.model.trim() && !draft.serial.trim()) return
  error.value = ''
  if (!isSaved() || Number(loc.id) < 0) {
    loc.machines = loc.machines || []
    loc.machines.push({
      id: nextTmp(),
      brand: draft.brand,
      model: draft.model,
      serial: draft.serial,
    })
    machineDrafts.value[String(loc.id)] = { brand: '', model: '', serial: '' }
    return
  }
  await withBusy(`machine-add:${loc.id}`, async () => {
    await api.post(`/api/locations/${loc.id}/machines`, {
      brand: draft.brand,
      model: draft.model,
      serial: draft.serial,
    })
    machineDrafts.value[String(loc.id)] = { brand: '', model: '', serial: '' }
    await refreshEditing()
  })
}

async function saveMachine(m: any) {
  if (!isSaved() || Number(m.id) < 0) return
  await withBusy(`machine:${m.id}`, async () => {
    await api.put(`/api/machines/${m.id}`, { brand: m.brand, model: m.model, serial: m.serial, notes: m.notes })
    await refreshEditing()
  })
}

async function deleteMachine(m: any) {
  if (!isSaved() || Number(m.id) < 0) {
    for (const loc of editing.value.locations) {
      loc.machines = (loc.machines || []).filter((x: any) => x.id !== m.id)
    }
    return
  }
  await withBusy(`machine-del:${m.id}`, async () => {
    await api.delete(`/api/machines/${m.id}`)
    await refreshEditing()
  })
}

function askDelete() {
  confirmOpen.value = true
}

const canWrite = computed(() => (isSaved() ? auth.can('clients.update') : auth.can('clients.create')))

const wizardSteps = computed(() => [
  { id: 1, label: t('clients.stepProfile'), hint: t('clients.stepProfileHint') },
  { id: 2, label: t('clients.stepSites'), hint: t('clients.stepSitesHint') },
  { id: 3, label: t('clients.stepMachines'), hint: t('clients.stepMachinesHint') },
])

function validateStep(n: number) {
  error.value = ''
  if (n === 1 && !String(editing.value?.name || '').trim()) {
    error.value = t('clients.needName')
    return false
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
  if (!canWrite.value) return
  void saveClient()
}

async function deleteClient() {
  if (confirming.value) return
  confirming.value = true
  error.value = ''
  try {
    const id = editing.value.id
    await api.delete(`/api/clients/${id}`)
    confirmOpen.value = false
    modals.closeClient()
    modals.notifySaved('client-deleted', id)
  } catch (e) {
    error.value = apiError(e)
    confirmOpen.value = false
  } finally {
    confirming.value = false
  }
}

watch(
  () => [modals.clientForm.token, modals.clientForm.open] as const,
  async ([token, isOpen]) => {
    if (!isOpen || !token) return
    if (modals.clientForm.id) await startEdit(modals.clientForm.id)
    else startCreate()
  },
)
</script>

<template>
  <FormDialog
    v-model:open="open"
    :title="isSaved() ? t('clients.editTitle') : t('clients.createTitle')"
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

    <div v-if="editing && step === 1" class="grid min-h-[18rem] gap-4">
      <section class="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <p class="mb-3 text-sm font-medium">{{ t('clients.stepProfile') }}</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <Field :label="t('common.name')"><Input v-model="editing.name" required /></Field>
          <Field :label="t('common.notes')"><Input v-model="editing.notes" /></Field>
        </div>
      </section>

      <section class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <div class="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-slate-700">
          <div>
            <p class="text-sm font-medium">{{ t('clients.phones') }}</p>
            <p class="text-xs text-slate-500">{{ t('common.optional') }}</p>
          </div>
        </div>
        <div v-if="!editing.phones?.length" class="px-3 py-6 text-center text-sm text-slate-400">{{ t('clients.noPhones') }}</div>
        <div
          v-for="p in editing.phones"
          :key="p.id"
          dir="ltr"
          class="flex items-center gap-2 border-t border-slate-100 px-3 py-2 dark:border-slate-800"
        >
          <Input v-model="p.country_code" class="w-20 shrink-0" placeholder="+965" />
          <Input v-model="p.phone" class="flex-1" :placeholder="t('clients.phone')" />
          <Button v-if="auth.can('clients.update')" type="button" size="sm" variant="outline" :loading="busyKey === `phone:${p.id}`" @click="savePhone(p)">{{ t('common.save') }}</Button>
          <DeleteButton v-if="auth.can('clients.update')" icon-only :loading="busyKey === `phone-del:${p.id}`" @click="deletePhone(p)" />
        </div>
        <div dir="ltr" class="flex items-center gap-2 border-t border-slate-100 px-3 py-2 dark:border-slate-800">
          <Input v-model="newPhone.country_code" class="w-20 shrink-0" placeholder="+965" />
          <Input v-model="newPhone.phone" class="flex-1" :placeholder="t('clients.newPhone')" />
          <Button v-if="canWrite" type="button" size="sm" variant="outline" :loading="busyKey === 'phone:add'" @click="addPhone">
            <Plus class="size-3.5" /> {{ t('common.add') }}
          </Button>
        </div>
      </section>

      <DeleteButton v-if="isSaved() && auth.can('clients.delete')" :label="t('clients.deleteClient')" class="justify-self-start" @click="askDelete" />
    </div>

    <div v-else-if="editing && step === 2" class="grid min-h-[18rem] gap-4">
      <section
        v-for="loc in editing.locations"
        :key="loc.id"
        class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
      >
        <div class="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-slate-700">
          <Input v-model="loc.label" class="max-w-48" :placeholder="t('clients.label')" />
          <div class="flex gap-1">
            <Button v-if="auth.can('clients.update')" type="button" size="sm" variant="outline" :loading="busyKey === `loc:${loc.id}`" @click="saveLocation(loc)">{{ t('common.save') }}</Button>
            <DeleteButton v-if="auth.can('clients.update')" icon-only :loading="busyKey === `loc-del:${loc.id}`" @click="deleteLocation(loc)" />
          </div>
        </div>
        <div class="p-3">
          <AddressFields :loc="loc" />
        </div>
      </section>

      <section class="rounded-xl border border-dashed border-slate-200 p-3 dark:border-slate-700">
        <p class="mb-3 text-sm font-medium">{{ t('clients.newLocation') }}</p>
        <Input v-model="newLoc.label" class="mb-3 max-w-48" :placeholder="t('clients.label')" />
        <AddressFields :loc="newLoc" />
        <Button v-if="canWrite" type="button" size="sm" variant="outline" class="mt-3" :loading="busyKey === 'loc:add'" @click="addLocation">
          <Plus class="size-3.5" /> {{ t('clients.addLocation') }}
        </Button>
      </section>
    </div>

    <div v-else-if="editing" class="grid min-h-[18rem] gap-4">
      <p v-if="!editing.locations?.length" class="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-400 dark:border-slate-700">
        {{ t('clients.noLocations') }}
      </p>
      <section
        v-for="loc in editing.locations"
        :key="loc.id"
        class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
      >
        <div class="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-slate-700">
          <div>
            <p class="text-sm font-medium">{{ loc.label || t('clients.location') }}</p>
            <p class="text-xs text-slate-500">{{ t('clients.machineCount', { n: loc.machines?.length || 0 }) }}</p>
          </div>
        </div>
        <div v-if="!loc.machines?.length" class="px-3 py-6 text-center text-sm text-slate-400">{{ t('clients.noMachines') }}</div>
        <div
          v-for="m in loc.machines"
          :key="m.id"
          class="grid gap-2 border-t border-slate-100 px-3 py-2 sm:grid-cols-[1fr_1fr_1fr_auto_auto] sm:items-center dark:border-slate-800"
        >
          <Input v-model="m.brand" :placeholder="t('clients.brand')" />
          <Input v-model="m.model" :placeholder="t('clients.model')" />
          <Input v-model="m.serial" :placeholder="t('clients.serial')" />
          <Button v-if="auth.can('clients.update')" type="button" size="sm" variant="outline" :loading="busyKey === `machine:${m.id}`" @click="saveMachine(m)">{{ t('common.save') }}</Button>
          <DeleteButton v-if="auth.can('clients.update')" icon-only :loading="busyKey === `machine-del:${m.id}`" @click="deleteMachine(m)" />
        </div>
        <div class="grid gap-2 border-t border-slate-100 px-3 py-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center dark:border-slate-800">
          <Input v-model="draftFor(loc.id).brand" :placeholder="t('clients.brand')" />
          <Input v-model="draftFor(loc.id).model" :placeholder="t('clients.model')" />
          <Input v-model="draftFor(loc.id).serial" :placeholder="t('clients.serial')" />
          <Button v-if="canWrite" type="button" size="sm" variant="outline" :loading="busyKey === `machine-add:${loc.id}`" @click="addMachine(loc)">
            <Plus class="size-3.5" /> {{ t('clients.addMachine') }}
          </Button>
        </div>
      </section>
    </div>

    <template #footer>
      <Button variant="outline" type="button" :disabled="saving" @click="open = false">{{ t('common.cancel') }}</Button>
      <div class="flex gap-2">
        <Button v-if="step > 1" type="button" variant="outline" :disabled="saving" @click="prevStep">{{ t('common.back') }}</Button>
        <Button type="submit" :disabled="step === lastStep && !canWrite" :loading="saving">
          {{ step < lastStep ? t('contracts.continue') : (isSaved() ? t('clients.saveClient') : t('clients.createClient')) }}
        </Button>
      </div>
    </template>
  </FormDialog>

  <ConfirmDialog
    v-model:open="confirmOpen"
    :title="t('clients.deleteTitle')"
    :description="t('clients.deleteDesc')"
    :confirm-label="t('common.delete')"
    variant="destructive"
    :loading="confirming"
    @confirm="deleteClient"
  />
</template>

