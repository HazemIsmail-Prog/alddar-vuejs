<script setup lang="ts" generic="T extends string">
import { computed, ref } from 'vue'
import { Check, CirclePlus } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const props = defineProps<{
  label: string
  options: { value: T; label: string }[]
  none?: T
}>()

const selected = defineModel<T>({ required: true })
const open = ref(false)
const noneValue = computed(() => props.none ?? ('all' as T))
const active = computed(() => selected.value !== noneValue.value)
const current = computed(() => props.options.find((row) => row.value === selected.value))

function pick(value: T) {
  selected.value = value
  open.value = false
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        type="button"
        variant="outline"
        size="sm"
        :class="cn('h-8 border-dashed font-normal', active && 'border-accent/50 bg-accent/5')"
      >
        <CirclePlus class="size-3.5 opacity-70" />
        {{ label }}
        <template v-if="active && current">
          <Separator orientation="vertical" class="mx-0.5 h-4" />
          <Badge variant="secondary" class="rounded-sm px-1 font-normal">{{ current.label }}</Badge>
        </template>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-48 p-1" align="start">
      <button
        v-for="row in options"
        :key="row.value"
        type="button"
        :class="cn(
          'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-start text-sm hover:bg-slate-100 dark:hover:bg-white/5',
          row.value === selected && 'bg-slate-50 dark:bg-white/5',
        )"
        @click="pick(row.value)"
      >
        <Check :class="cn('size-3.5 shrink-0', row.value === selected ? 'opacity-100' : 'opacity-0')" />
        {{ row.label }}
      </button>
    </PopoverContent>
  </Popover>
</template>
