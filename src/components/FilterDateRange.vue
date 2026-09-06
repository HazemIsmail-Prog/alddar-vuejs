<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DateFormatter, getLocalTimeZone, parseDate, type DateValue } from '@internationalized/date'
import type { DateRange } from 'reka-ui'
import { CalendarDays } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RangeCalendar } from '@/components/ui/range-calendar'
import { cn } from '@/lib/utils'

const props = defineProps<{
  label: string
}>()

const from = defineModel<string>('from', { default: '' })
const to = defineModel<string>('to', { default: '' })
const open = ref(false)
const { t, locale } = useI18n()

const calendarLocale = computed(() => (locale.value === 'ar' ? 'ar' : 'en-GB'))
const formatter = computed(() => new DateFormatter(calendarLocale.value, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}))

function parseIso(value: string): DateValue | undefined {
  if (!value) return undefined
  try {
    return parseDate(value)
  }
  catch {
    return undefined
  }
}

function formatIso(value: string) {
  const date = parseIso(value)
  return date ? formatter.value.format(date.toDate(getLocalTimeZone())) : value
}

const range = computed<DateRange>(() => ({
  start: parseIso(from.value),
  end: parseIso(to.value),
}))

const active = computed(() => Boolean(from.value || to.value))
const summary = computed(() => {
  if (from.value && to.value) return `${formatIso(from.value)} – ${formatIso(to.value)}`
  if (from.value) return `${t('orders.dateFrom')} ${formatIso(from.value)}`
  if (to.value) return `${t('orders.dateTo')} ${formatIso(to.value)}`
  return ''
})

function onRange(value: DateRange | undefined) {
  from.value = value?.start?.toString() ?? ''
  to.value = value?.end?.toString() ?? ''
}

function clear() {
  from.value = ''
  to.value = ''
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        type="button"
        variant="outline"
        size="sm"
        :class="cn('h-8 border-dashed font-normal', active && 'border-accent/50 bg-accent/5')"
      >
        <CalendarDays class="size-3.5 opacity-70" />
        {{ label }}
        <template v-if="active">
          <Separator orientation="vertical" class="mx-0.5 h-4" />
          <Badge variant="secondary" class="max-w-44 truncate rounded-sm px-1 font-normal">
            {{ summary }}
          </Badge>
        </template>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-0" align="start">
      <RangeCalendar
        :model-value="range"
        :locale="calendarLocale"
        initial-focus
        @update:model-value="onRange"
      />
      <Separator />
      <div class="p-1">
        <Button type="button" variant="ghost" size="sm" class="h-8 w-full font-normal" :disabled="!active" @click="clear">
          {{ t('common.clear') }}
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>
