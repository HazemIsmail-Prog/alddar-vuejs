<script setup lang="ts">
import { SelectRoot, type SelectRootEmits, type SelectRootProps } from 'reka-ui'

const props = defineProps<SelectRootProps>()
const emit = defineEmits<SelectRootEmits>()
</script>

<template>
  <SelectRoot v-bind="props" @update:model-value="emit('update:modelValue', $event)" @update:open="emit('update:open', $event)">
    <slot />
  </SelectRoot>
</template>
