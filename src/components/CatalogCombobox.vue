<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, ChevronsUpDown, Search, X } from '@lucide/vue'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface CatalogItem {
  id: number | string
  name: string
  sku?: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  catalog: CatalogItem[]
  itemLabel?: (item: CatalogItem) => string
  placeholder?: string
}>(), {
  itemLabel: (item: CatalogItem) => item.name,
  placeholder: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: []
}>()

const { t } = useI18n()

const open = ref(false)
const query = ref('')
const searchRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const activeIndex = ref(-1)

const selected = computed(() => props.catalog.find((row) => String(row.id) === props.modelValue))

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.catalog
  return props.catalog.filter((row) => `${props.itemLabel(row)} ${row.sku ?? ''}`.toLowerCase().includes(q))
})

function labelOf(item: CatalogItem) {
  return props.itemLabel(item)
}

function pick(item: CatalogItem) {
  emit('update:modelValue', String(item.id))
  emit('change')
  closePopover()
}

function clear(e: MouseEvent) {
  e.stopPropagation()
  emit('update:modelValue', '')
  emit('change')
}

function closePopover() {
  open.value = false
  query.value = ''
  activeIndex.value = -1
}

function onOpenChange(value: boolean) {
  open.value = value
  if (value) {
    query.value = ''
    activeIndex.value = -1
    nextTick(() => searchRef.value?.focus())
  }
}

function onKeydown(e: KeyboardEvent) {
  const list = filtered.value
  if (!list.length) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % list.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + list.length) % list.length
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const item = list[activeIndex.value]
    if (item) {
      pick(item)
    }
  }
}

watch(activeIndex, (index) => {
  nextTick(() => {
    const el = listRef.value?.querySelector<HTMLElement>(`[data-index="${index}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  })
})
</script>

<template>
  <Popover v-model:open="open" @update:open="onOpenChange">
    <PopoverTrigger as-child>
      <button
        type="button"
        class="select flex select-none items-start justify-between gap-2 !h-auto text-start text-slate-700 dark:text-slate-200"
        :class="open && '!border-teal-700/70'"
      >
        <span class="min-w-0 flex-1 break-words whitespace-normal" :class="selected ? '' : 'text-slate-400 dark:text-slate-500'">
          {{ selected ? labelOf(selected) : placeholder }}
        </span>
        <span class="flex shrink-0 items-center gap-1 text-slate-400">
          <X v-if="selected" class="size-4 rounded hover:bg-slate-200 dark:hover:bg-slate-700" @click.stop="clear" />
          <ChevronsUpDown class="size-4" />
        </span>
      </button>
    </PopoverTrigger>
    <PopoverContent class="w-[min(30rem,calc(100vw-2rem))] p-1" align="start">
      <div class="relative">
        <Search class="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          ref="searchRef"
          v-model="query"
          class="h-9 ps-9 pe-3"
          :placeholder="placeholder"
          @keydown="onKeydown"
        />
      </div>
      <div ref="listRef" class="mt-1 max-h-72 overflow-y-auto">
        <button
          v-for="(item, index) in filtered"
          :key="item.id"
          type="button"
          :data-index="index"
          :class="cn(
            'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-start text-sm hover:bg-slate-100 dark:hover:bg-white/5',
            index === activeIndex && 'bg-slate-100 dark:bg-white/5',
            String(item.id) === modelValue && 'bg-slate-50 dark:bg-white/5',
          )"
          @mousemove="activeIndex = index"
          @click="pick(item)"
        >
          <Check :class="cn('size-4 shrink-0', String(item.id) === modelValue ? 'opacity-100' : 'opacity-0')" />
          <span class="min-w-0 flex-1 break-words whitespace-normal">{{ labelOf(item) }}</span>
          <span class="shrink-0 text-xs text-slate-400">{{ item.sku }}</span>
        </button>
        <p v-if="!filtered.length" class="px-2 py-4 text-center text-sm text-slate-400">
          {{ t('common.noResults') }}
        </p>
      </div>
    </PopoverContent>
  </Popover>
</template>