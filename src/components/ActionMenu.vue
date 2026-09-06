<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { EllipsisVertical } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'

export type ActionMenuItem = {
  id: string
  label: string
  danger?: boolean
  disabled?: boolean
  show?: boolean
}

const props = defineProps<{
  items: ActionMenuItem[]
  label?: string
  badge?: number
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const { t } = useI18n()
const open = ref(false)
const trigger = ref<HTMLElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)
const coords = ref({ top: 0, left: 0 })

onClickOutside(trigger, () => { open.value = false }, { ignore: [menuEl] })

const visible = computed(() => props.items.filter((item) => item.show !== false))

function place() {
  const el = trigger.value
  const panel = menuEl.value
  if (!el || !open.value) return
  const rect = el.getBoundingClientRect()
  const width = Math.max(panel?.offsetWidth || 0, 176)
  const height = panel?.offsetHeight || visible.value.length * 36 + 8
  const gap = 4
  const openUp = rect.bottom + gap + height > window.innerHeight - 8 && rect.top > height + gap
  const rtl = document.documentElement.dir === 'rtl'
  const left = rtl
    ? Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)
    : Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8)
  coords.value = {
    top: openUp ? rect.top - height - gap : rect.bottom + gap,
    left,
  }
}

async function toggle() {
  open.value = !open.value
}

function pick(item: ActionMenuItem) {
  if (item.disabled) return
  open.value = false
  emit('select', item.id)
}

function onReposition() {
  if (open.value) place()
}

function bindMove(on: boolean) {
  if (on) {
    window.addEventListener('scroll', onReposition, true)
    window.addEventListener('resize', onReposition)
  } else {
    window.removeEventListener('scroll', onReposition, true)
    window.removeEventListener('resize', onReposition)
  }
}

watch(open, async (isOpen) => {
  bindMove(isOpen)
  if (!isOpen) return
  await nextTick()
  place()
  await nextTick()
  place()
})

onUnmounted(() => bindMove(false))
</script>

<template>
  <div v-if="visible.length" ref="trigger" class="relative inline-flex" @click.stop>
    <Button
      type="button"
      variant="ghost"
      size="icon"
      class="relative"
      :aria-label="label || t('common.actions')"
      :aria-expanded="open"
      @click="toggle"
    >
      <EllipsisVertical class="size-4" />
      <span
        v-if="badge"
        class="absolute -top-0.5 -end-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 text-white"
      >{{ badge > 99 ? '99+' : badge }}</span>
    </Button>
    <Teleport to="body">
      <div
        v-if="open"
        ref="menuEl"
        class="fixed z-[400] min-w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-[#151c2c]"
        :style="{ top: `${coords.top}px`, left: `${coords.left}px` }"
        @click.stop
      >
        <button
          v-for="item in visible"
          :key="item.id"
          type="button"
          class="block w-full px-3 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-white/5"
          :class="item.danger ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'"
          :disabled="item.disabled"
          @click="pick(item)"
        >
          {{ item.label }}
        </button>
      </div>
    </Teleport>
  </div>
</template>
