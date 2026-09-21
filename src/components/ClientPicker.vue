<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onClickOutside, useDebounceFn } from '@vueuse/core'
import { Plus, Search, X } from '@lucide/vue'
import api from '@/api/client'
import { addressComplete, blankAddress, locationPayload } from '@/lib/address'
import { DEFAULT_COUNTRY_CODE, formatPhone, phonePayload } from '@/lib/phone'
import { apiError } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import AddressFields from '@/components/AddressFields.vue'

export type ClientRecord = {
  id: number
  name: string
  phones?: { id: number; phone: string; country_code?: string; full_phone?: string; is_primary?: boolean }[]
  locations?: { id: number; label: string; address: string; machines?: any[] }[]
}

const props = withDefaults(
  defineProps<{
    modelValue?: number | string | null
    allowCreate?: boolean
    placeholder?: string
  }>(),
  { allowCreate: true },
)

const emit = defineEmits<{
  'update:modelValue': [value: number | '']
  select: [client: ClientRecord | null]
}>()

const { t } = useI18n()

const query = ref('')
const open = ref(false)
const loading = ref(false)
const creating = ref(false)
const showCreate = ref(false)
const error = ref('')
const results = ref<ClientRecord[]>([])
const active = ref(0)
const selected = ref<ClientRecord | null>(null)
const root = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
function blankCreateForm() {
  return { name: '', phone: '', country_code: DEFAULT_COUNTRY_CODE, label: 'المنزل', ...blankAddress() }
}

const createForm = ref(blankCreateForm())

const phone = (c: ClientRecord) => c.phones?.map((p) => formatPhone(p)).filter(Boolean).join(', ') || ''
const locationHint = (c: ClientRecord) =>
  c.locations?.map((l) => l.label).slice(0, 2).join(', ') || ''

const canSearch = computed(() => query.value.trim().length >= 2)

const runSearch = useDebounceFn(async () => {
  if (!canSearch.value) {
    results.value = []
    loading.value = false
    return
  }
  loading.value = true
  try {
    const { data } = await api.get('/api/clients', {
      params: { search: query.value.trim(), per_page: 8, compact: 1 },
    })
    results.value = data.data
    active.value = 0
  } finally {
    loading.value = false
  }
}, 250)

async function loadSelected(id: number) {
  const { data } = await api.get(`/api/clients/${id}`)
  selected.value = data
  query.value = data.name
  emit('update:modelValue', data.id)
  emit('select', data)
}

async function pick(client: ClientRecord) {
  open.value = false
  showCreate.value = false
  await loadSelected(client.id)
}

function clear() {
  selected.value = null
  query.value = ''
  results.value = []
  emit('update:modelValue', '')
  emit('select', null)
  nextTick(() => inputEl.value?.focus())
}

function onInput() {
  if (selected.value && query.value !== selected.value.name) {
    selected.value = null
    emit('update:modelValue', '')
    emit('select', null)
  }
  open.value = true
  showCreate.value = false
  runSearch()
}

function onFocus() {
  open.value = true
  if (canSearch.value) runSearch()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    open.value = false
    showCreate.value = false
    return
  }
  if (e.key === 'Enter' && open.value) {
    e.preventDefault()
    const client = results.value[active.value]
    if (client) pick(client)
    return
  }
  if (!open.value && e.key === 'ArrowDown') {
    open.value = true
    return
  }
  if (!results.value.length) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    active.value = (active.value + 1) % results.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    active.value = (active.value - 1 + results.value.length) % results.value.length
  }
}

async function createClient() {
  if (creating.value || !createForm.value.name) return
  error.value = ''
  creating.value = true
  try {
    const { data } = await api.post('/api/clients', {
      name: createForm.value.name,
      phones: createForm.value.phone ? [phonePayload({ ...createForm.value, is_primary: true })] : [],
      locations: addressComplete(createForm.value)
        ? [locationPayload(createForm.value)]
        : [],
    })
    createForm.value = blankCreateForm()
    await pick(data)
  } catch (e) {
    error.value = apiError(e)
  } finally {
    creating.value = false
  }
}

onClickOutside(root, () => {
  open.value = false
  showCreate.value = false
})

watch(
  () => props.modelValue,
  async (id) => {
    if (!id) {
      if (selected.value) {
        selected.value = null
        query.value = ''
      }
      return
    }
    if (selected.value?.id === Number(id)) return
    await loadSelected(Number(id))
  },
)
</script>

<template>
  <div ref="root" class="relative">
    <div class="relative">
      <Search class="pointer-events-none absolute top-2.5 start-2.5 size-4 text-slate-400" />
      <input
        ref="inputEl"
        v-model="query"
        type="text"
        autocomplete="off"
        :placeholder="placeholder || t('picker.placeholder')"
        class="flex h-9 w-full rounded-lg border border-slate-300 bg-white py-1 pe-8 ps-8 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/30 dark:border-slate-700 dark:bg-[#151c2c] dark:text-slate-100"
        @focus="onFocus"
        @input="onInput"
        @keydown="onKey"
      />
      <button
        v-if="query"
        type="button"
        class="absolute top-1.5 end-1.5 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
        @click="clear"
      >
        <X class="size-3.5" />
      </button>
    </div>

    <div
      v-if="open"
      class="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700"
    >
      <p v-if="!canSearch" class="px-3 py-3 text-sm text-slate-500">{{ t('picker.hint') }}</p>
      <p v-else-if="loading" class="px-3 py-3 text-sm text-slate-500">{{ t('common.searching') }}</p>
      <p v-else-if="!results.length && !showCreate" class="px-3 py-3 text-sm text-slate-500">{{ t('picker.none') }}</p>
      <ul v-else-if="results.length" class="max-h-60 overflow-y-auto py-1">
        <li v-for="(c, i) in results" :key="c.id">
          <button
            type="button"
            class="flex w-full flex-col items-start px-3 py-2 text-start text-sm"
            :class="i === active ? 'bg-teal-50 dark:bg-teal-950/40' : 'hover:bg-slate-50 dark:hover:bg-white/5'"
            @click="pick(c)"
          >
            <span class="font-medium">{{ c.name }}</span>
            <span v-if="phone(c)" dir="ltr" class="phone-num text-xs text-slate-500">{{ phone(c) }}</span>
            <span v-else class="text-xs text-slate-500">{{ t('picker.noPhone') }}</span>
            <span v-if="phone(c)" class="text-xs text-slate-500"> · </span>
            <span class="text-xs text-slate-500">{{ locationHint(c) || t('picker.noLocation') }}</span>
          </button>
        </li>
      </ul>

      <div v-if="allowCreate" class="border-t border-slate-100 p-2 dark:border-slate-800">
        <button
          v-if="!showCreate"
          type="button"
          class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm text-accent hover:bg-slate-50 dark:hover:bg-white/5"
          @click="showCreate = true; createForm.name = canSearch ? query : createForm.name"
        >
          <Plus class="size-4" /> {{ t('picker.create') }}
        </button>
        <div v-else class="grid max-h-80 gap-2 overflow-y-auto p-1">
          <p class="text-xs font-medium text-slate-600">{{ t('picker.newClient') }}</p>
          <Input v-model="createForm.name" :placeholder="t('picker.name')" />
          <div dir="ltr" class="flex gap-2">
            <Input v-model="createForm.country_code" class="w-20" placeholder="+965" />
            <Input v-model="createForm.phone" :placeholder="t('picker.phone')" />
          </div>
          <Input v-model="createForm.label" :placeholder="t('picker.locationLabel')" />
          <AddressFields :loc="createForm" />
          <p v-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
          <div class="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" @click="showCreate = false">{{ t('common.back') }}</Button>
            <Button type="button" size="sm" :loading="creating" :disabled="!createForm.name" @click="createClient">
              {{ creating ? t('common.saving') : t('picker.saveSelect') }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
