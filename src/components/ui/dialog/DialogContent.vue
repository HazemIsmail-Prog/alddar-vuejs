<script setup lang="ts">
import { computed } from 'vue'
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, injectDialogRootContext } from 'reka-ui'
import { X } from '@lucide/vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string; raised?: boolean }>()
const root = injectDialogRootContext()
const open = computed(() => root.open.value)
</script>

<template>
  <DialogPortal>
    <div v-if="open" :class="['dialog-layer', props.raised && 'dialog-layer-raised']">
      <div class="dialog-overlay" aria-hidden="true" />
      <DialogOverlay class="dialog-overlay-lock" />
      <DialogContent
        :class="
          cn(
            'dialog-panel relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl outline-none md:rounded-xl dark:border-slate-700',
            props.class,
          )
        "
      >
        <slot />
        <DialogClose class="absolute top-3.5 end-3.5 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white">
          <X class="size-4" />
        </DialogClose>
      </DialogContent>
    </div>
  </DialogPortal>
</template>
