<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<{
  modelValue?: boolean
  disabled?: boolean
  id?: string
  class?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <SwitchRoot
    :id="props.id"
    :model-value="!!props.modelValue"
    :disabled="props.disabled"
    :class="
      cn(
        'inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-accent data-[state=unchecked]:bg-slate-200 dark:data-[state=unchecked]:bg-slate-600',
        props.class,
      )
    "
    @update:model-value="emit('update:modelValue', $event)"
    @click.stop
  >
    <SwitchThumb
      class="pointer-events-none block size-4 rounded-full bg-[#fff] shadow-sm ring-0 transition-transform data-[state=unchecked]:translate-x-0 ltr:data-[state=checked]:translate-x-4 rtl:data-[state=checked]:-translate-x-4"
    />
  </SwitchRoot>
</template>
