<script setup lang="ts">
import { Moon, Sun } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { useThemeStore } from '@/stores/theme'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{ compact?: boolean; surface?: 'sidebar' | 'page' }>(), {
  compact: false,
  surface: 'sidebar',
})

const { t } = useI18n()
const theme = useThemeStore()
</script>

<template>
  <Button
    type="button"
    variant="ghost"
    size="sm"
    :class="
      cn(
        props.surface === 'sidebar' && 'h-10 w-full justify-start gap-2.5 overflow-hidden ps-4 pe-2 text-sidebar-muted hover:!bg-white/10 hover:!text-white',
        props.surface === 'page' && 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
      )
    "
    @click="theme.toggle()"
  >
    <Sun v-if="theme.mode === 'dark'" class="size-4 shrink-0" />
    <Moon v-else class="size-4 shrink-0" />
    <span
      class="truncate whitespace-nowrap transition-opacity duration-200 ease-in-out"
      :class="props.compact ? 'pointer-events-none opacity-0' : 'opacity-100 delay-75'"
    >{{ theme.mode === 'dark' ? t('theme.light') : t('theme.dark') }}</span>
  </Button>
</template>
