<script setup lang="ts" generic="T extends string | number">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { CirclePlus, Search } from '@lucide/vue'
import { CheckboxGroupRoot } from 'reka-ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const props = defineProps<{
  label: string
  options: { value: T; label: string }[]
  empty?: string
}>()

const selected = defineModel<T[]>({ default: () => [] })
const open = ref(false)
const query = ref('')
const { t } = useI18n()

const count = computed(() => selected.value.length)
const selectedRows = computed(() =>
  props.options.filter((row) => selected.value.includes(row.value)),
)
const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter((row) => row.label.toLowerCase().includes(q))
})

function clear() {
  selected.value = []
  query.value = ''
}

function onOpen(next: boolean) {
  open.value = next
  if (!next) query.value = ''
}
</script>

<template>
  <Popover :open="open" @update:open="onOpen">
    <PopoverTrigger as-child>
      <Button
        type="button"
        variant="outline"
        size="sm"
        :class="cn('h-8 border-dashed font-normal', count && 'border-accent/50 bg-accent/5')"
      >
        <CirclePlus class="size-3.5 opacity-70" />
        {{ label }}
        <template v-if="count">
          <Separator orientation="vertical" class="mx-0.5 h-4" />
          <Badge v-if="count > 2" variant="secondary" class="rounded-sm px-1 font-normal">
            {{ count }}
          </Badge>
          <div v-else class="hidden items-center gap-1 sm:flex">
            <Badge
              v-for="row in selectedRows"
              :key="String(row.value)"
              variant="secondary"
              class="max-w-28 truncate rounded-sm px-1 font-normal"
            >
              {{ row.label }}
            </Badge>
          </div>
          <Badge v-if="count <= 2" variant="secondary" class="rounded-sm px-1 font-normal sm:hidden">
            {{ count }}
          </Badge>
        </template>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-56 p-0" align="start">
      <div class="flex items-center gap-2 border-b border-slate-200 px-3 dark:border-slate-700">
        <Search class="size-3.5 shrink-0 opacity-50" />
        <input
          v-model="query"
          type="search"
          :placeholder="label"
          class="h-9 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        >
      </div>
      <CheckboxGroupRoot v-model="selected" class="flex max-h-64 flex-col overflow-auto p-1">
        <Label
          v-for="row in visible"
          :key="String(row.value)"
          class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 font-normal hover:bg-slate-100 dark:hover:bg-white/5"
        >
          <Checkbox :value="row.value" />
          <span class="truncate">{{ row.label }}</span>
        </Label>
        <p v-if="!visible.length" class="px-2 py-3 text-center text-sm text-slate-400">
          {{ empty || t('common.noResults') }}
        </p>
      </CheckboxGroupRoot>
      <template v-if="count">
        <Separator />
        <div class="p-1">
          <Button type="button" variant="ghost" size="sm" class="h-8 w-full font-normal" @click="clear">
            {{ t('common.clear') }}
          </Button>
        </div>
      </template>
    </PopoverContent>
  </Popover>
</template>
