<script setup lang="ts">
import { computed } from 'vue'
import { Check } from '@lucide/vue'
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<{
  modelValue?: boolean | 'indeterminate' | null
  value?: string | number | boolean
  disabled?: boolean
  id?: string
  class?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean | 'indeterminate']
}>()

const rootBind = computed(() => {
  const bind: Record<string, unknown> = {
    id: props.id,
    value: props.value,
    disabled: props.disabled,
  }
  if (props.modelValue !== undefined) bind.modelValue = props.modelValue
  return bind
})
</script>

<template>
  <CheckboxRoot
    v-bind="rootBind"
    :class="cn(
      'flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-slate-300 shadow-sm',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
      'data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-white',
      'data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent data-[state=indeterminate]:text-white',
      'disabled:cursor-not-allowed disabled:opacity-50',
      props.class,
    )"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <CheckboxIndicator class="flex items-center justify-center text-current">
      <Check class="size-3" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
