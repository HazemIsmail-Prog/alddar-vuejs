<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useLocaleStore } from '@/stores/locale'

const props = withDefaults(defineProps<{
  text: string
  enabled?: boolean
  side?: 'top' | 'right' | 'bottom' | 'left'
  inline?: boolean
}>(), {
  enabled: true,
  inline: false,
})

const locale = useLocaleStore()
const open = ref(false)
const wrap = ref<HTMLElement | null>(null)
const pos = ref({ top: 0, left: 0 })

const placement = computed(() => props.side ?? (locale.locale === 'ar' ? 'left' : 'right'))

const style = computed(() => {
  const { top, left } = pos.value
  if (placement.value === 'left') {
    return { top: `${top}px`, left: `${left}px`, transform: 'translate(-100%, -50%)' }
  }
  if (placement.value === 'bottom') {
    return { top: `${top}px`, left: `${left}px`, transform: 'translate(-50%, 0)' }
  }
  if (placement.value === 'top') {
    return { top: `${top}px`, left: `${left}px`, transform: 'translate(-50%, -100%)' }
  }
  return { top: `${top}px`, left: `${left}px`, transform: 'translate(0, -50%)' }
})

function updatePos() {
  const el = wrap.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const gap = 10
  if (placement.value === 'left') {
    pos.value = { top: r.top + r.height / 2, left: r.left - gap }
  } else if (placement.value === 'bottom') {
    pos.value = { top: r.bottom + gap, left: r.left + r.width / 2 }
  } else if (placement.value === 'top') {
    pos.value = { top: r.top - gap, left: r.left + r.width / 2 }
  } else {
    pos.value = { top: r.top + r.height / 2, left: r.right + gap }
  }
}

function show() {
  if (!props.enabled) return
  updatePos()
  open.value = true
}

function hide() {
  open.value = false
}

onBeforeUnmount(hide)
</script>

<template>
  <div
    ref="wrap"
    class="flex min-w-0"
    :class="inline ? 'w-auto' : 'w-full'"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
  >
    <slot />
  </div>
  <Teleport to="body">
    <div
      v-if="open && enabled"
      class="pointer-events-none fixed z-[200] whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg dark:bg-slate-700"
      :style="style"
    >
      {{ text }}
    </div>
  </Teleport>
</template>
