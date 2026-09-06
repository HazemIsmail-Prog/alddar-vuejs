<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useLocaleStore } from '@/stores/locale'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{ compact?: boolean; surface?: 'sidebar' | 'page' }>(), {
  compact: false,
  surface: 'sidebar',
})

const { t } = useI18n()
const locale = useLocaleStore()
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
    @click="locale.toggle()"
  >
    <span class="flex size-4 shrink-0 items-center justify-center text-xs font-semibold">{{ locale.locale === 'ar' ? 'EN' : 'ع' }}</span>
    <span
      class="truncate whitespace-nowrap transition-opacity duration-200 ease-in-out"
      :class="props.compact ? 'pointer-events-none opacity-0' : 'opacity-100 delay-75'"
    >{{ locale.locale === 'ar' ? t('locale.english') : t('locale.arabic') }}</span>
  </Button>
</template>
