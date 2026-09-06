<script setup lang="ts">
import { computed } from 'vue'
import { Trash2 } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'

const props = withDefaults(defineProps<{
  iconOnly?: boolean
  label?: string
  disabled?: boolean
  loading?: boolean
  class?: string
}>(), {
  iconOnly: false,
})

const { t } = useI18n()
const text = computed(() => props.label ?? t('common.delete'))
</script>

<template>
  <Button
    type="button"
    variant="danger"
    :size="iconOnly ? 'icon-sm' : 'sm'"
    :disabled="disabled"
    :loading="loading"
    :class="props.class"
    :aria-label="iconOnly ? text : undefined"
  >
    <Trash2 class="size-3.5" />
    <span v-if="!iconOnly">{{ text }}</span>
  </Button>
</template>
