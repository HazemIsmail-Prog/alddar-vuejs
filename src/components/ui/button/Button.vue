<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { LoaderCircle } from '@lucide/vue'
import { Primitive } from 'reka-ui'
import { cn } from '@/lib/utils'
import { buttonVariants } from './variants'

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes['class']
    type?: 'button' | 'submit'
    disabled?: boolean
    loading?: boolean
    variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'danger'
    size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-xs'
    as?: PrimitiveProps['as']
    asChild?: boolean
  }>(),
  { type: 'button', variant: 'default', size: 'default', as: 'button' },
)

const isIcon = computed(() => props.size === 'icon' || props.size === 'icon-sm' || props.size === 'icon-xs')
const spinnerClass = computed(() => {
  if (props.size === 'icon-xs') return 'button-spinner size-3.5 animate-spin'
  if (props.size === 'sm' || props.size === 'icon-sm') return 'button-spinner size-3.5 animate-spin'
  return 'button-spinner size-4 animate-spin'
})
</script>

<template>
  <Primitive
    :as="props.as"
    :as-child="props.asChild"
    :type="props.as === 'button' && !props.asChild ? props.type : undefined"
    :disabled="props.disabled || props.loading"
    :aria-busy="props.loading || undefined"
    :class="cn(
      buttonVariants({ variant: props.variant, size: props.size }),
      props.loading && '[&_svg:not(.button-spinner)]:hidden',
      props.class,
    )"
  >
    <LoaderCircle v-if="props.loading" :class="spinnerClass" />
    <slot v-if="!(props.loading && isIcon)" />
  </Primitive>
</template>
