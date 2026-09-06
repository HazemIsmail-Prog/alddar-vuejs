<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { onClickOutside, useDebounceFn } from '@vueuse/core'
import { Search, X } from '@lucide/vue'
import api from '@/api/client'
import { actionLabel, personName } from '@/i18n'
import { useModalsStore } from '@/stores/modals'
import { useStatusStore } from '@/stores/statuses'

type SearchAction = { label: string; to?: string; modal?: string; client_id?: number }
type SearchItem = {
  id: number
  title: string
  subtitle: string
  href: string
  actions: SearchAction[]
  name_en?: string
  name_ar?: string
  technician?: { id: number; name_en: string; name_ar: string } | null
}
type SearchGroup = { type: string; label: string; items: SearchItem[] }

const props = withDefaults(defineProps<{ variant?: 'sidebar' | 'sheet' }>(), { variant: 'sidebar' })
const emit = defineEmits<{ navigate: [] }>()

const { t, te } = useI18n()
const router = useRouter()
const modals = useModalsStore()
const statuses = useStatusStore()
const query = ref('')
const open = ref(false)
const loading = ref(false)
const groups = ref<SearchGroup[]>([])
const root = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const input = ref<HTMLInputElement | null>(null)

function focus() {
  input.value?.focus()
}

defineExpose({ focus })

const canSearch = computed(() => {
  const q = query.value.trim()
  return q.length >= 2 || /^\d+$/.test(q.replace('#', ''))
})
const hasResults = computed(() => groups.value.some((g) => g.items.length))

function groupLabel(group: SearchGroup) {
  const key = `search.groups.${group.type}`
  return te(key) ? t(key) : group.label
}

function itemTitle(item: SearchItem) {
  if (item.name_en || item.name_ar) return personName(item)
  return item.title
}

function itemSubtitle(item: SearchItem) {
  const base = item.technician !== undefined && item.subtitle
    ? statuses.label(item.subtitle)
    : item.subtitle
  const tech = item.technician ? personName(item.technician) : ''
  return [base, tech].filter(Boolean).join(' · ')
}

const runSearch = useDebounceFn(async () => {
  if (!canSearch.value) {
    groups.value = []
    loading.value = false
    return
  }
  loading.value = true
  try {
    const { data } = await api.get('/api/search', { params: { q: query.value.trim() } })
    groups.value = data.groups || []
    open.value = true
  } finally {
    loading.value = false
  }
}, 220)

onClickOutside(root, () => {
  open.value = false
}, { ignore: [panel] })

function onInput() {
  open.value = true
  runSearch()
}

function clear() {
  query.value = ''
  groups.value = []
  open.value = false
}

async function go(to: string) {
  open.value = false
  query.value = ''
  groups.value = []
  emit('navigate')
  await router.push(to)
}

async function runAction(action: SearchAction) {
  open.value = false
  query.value = ''
  groups.value = []
  emit('navigate')
  if (await modals.runSearchAction(action)) return
  if (action.to) await router.push(action.to)
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    open.value = false
  }
  if (event.key === 'Enter' && groups.value[0]?.items[0]) {
    event.preventDefault()
    go(groups.value[0].items[0].href)
  }
}
</script>

<template>
  <div ref="root" class="relative" @keydown="onKey">
    <div class="relative">
      <Search class="pointer-events-none absolute top-2.5 start-2.5 size-3.5" :class="props.variant === 'sheet' ? 'text-slate-400' : 'text-sidebar-muted'" />
      <input
        ref="input"
        v-model="query"
        type="search"
        :placeholder="t('search.placeholder')"
        class="h-9 w-full rounded-lg pe-8 ps-8 text-sm outline-none"
        :class="props.variant === 'sheet'
          ? 'border border-slate-200 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:bg-slate-800'
          : 'border-0 bg-white/10 text-white placeholder:text-sidebar-muted focus:bg-white/15'"
        autocomplete="off"
        @focus="onInput"
        @input="onInput"
      />
      <button
        v-if="query"
        type="button"
        class="absolute top-2 end-2 text-sidebar-muted hover:text-white"
        :class="props.variant === 'sheet' && 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
        @click="clear"
      >
        <X class="size-3.5" />
      </button>
    </div>

    <Teleport to="body" :disabled="props.variant === 'sheet'">
      <div
        v-if="open && query"
        ref="panel"
        class="overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700"
        :class="props.variant === 'sheet'
          ? 'mt-2 max-h-72'
          : 'fixed top-20 start-60 z-50 max-h-[min(32rem,calc(100vh-6rem))] w-[22rem]'"
      >
        <p v-if="!canSearch" class="px-3 py-3 text-sm text-slate-500">{{ t('search.hint') }}</p>
        <p v-else-if="loading && !hasResults" class="px-3 py-3 text-sm text-slate-500">{{ t('common.searching') }}</p>
        <p v-else-if="!loading && !hasResults" class="px-3 py-3 text-sm text-slate-500">{{ t('search.none') }}</p>
        <div v-else class="py-1">
          <section v-for="group in groups" :key="group.type" class="border-b border-slate-100 last:border-0 dark:border-slate-800">
            <p class="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">{{ groupLabel(group) }}</p>
            <div v-for="item in group.items" :key="group.type + item.id" class="px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/5">
              <button type="button" class="block w-full text-start" @click="go(item.href)">
                <p class="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{{ itemTitle(item) }}</p>
                <p v-if="itemSubtitle(item)" class="truncate text-xs text-slate-500">{{ itemSubtitle(item) }}</p>
              </button>
              <div class="mt-1.5 flex flex-wrap gap-1">
                <button
                  v-for="action in item.actions"
                  :key="action.label"
                  type="button"
                  class="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:border-accent hover:text-accent dark:border-slate-600 dark:text-slate-200"
                  @click.stop="runAction(action)"
                >
                  {{ actionLabel(action.label) }}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Teleport>
  </div>
</template>
