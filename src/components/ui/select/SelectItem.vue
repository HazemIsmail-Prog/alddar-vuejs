<script setup lang="ts">
import { Check } from '@lucide/vue'
import { SelectItem, SelectItemIndicator, SelectItemText } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<{
  value: string
  disabled?: boolean
  class?: string
}>()
</script>

<template>
  <SelectItem
    :value="props.value"
    :disabled="props.disabled"
    :class="cn(
      'relative flex w-full cursor-pointer items-center rounded-md py-1.5 pe-8 ps-2 text-sm outline-none',
      'focus:bg-slate-100 data-[highlighted]:bg-slate-100 dark:text-slate-100 dark:focus:bg-white/10 dark:data-[highlighted]:bg-white/10',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      props.class,
    )"
  >
    <SelectItemText>
      <slot />
    </SelectItemText>
    <SelectItemIndicator class="absolute end-2 inline-flex items-center">
      <Check class="size-3.5 text-accent" />
    </SelectItemIndicator>
  </SelectItem>
</template>
