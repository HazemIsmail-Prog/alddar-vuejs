<script setup lang="ts">
import { MessageCircle, Phone } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { phoneDigits, telHref, whatsappHref } from '@/lib/phone'

defineProps<{
  phone: { country_code?: string | null; phone?: string | null; full_phone?: string | null }
  iconClass?: string
  gapClass?: string
}>()

const { t } = useI18n()
</script>

<template>
  <div v-if="phoneDigits(phone)" class="flex shrink-0" :class="gapClass || 'gap-1.5'">
    <a
      :href="telHref(phone)"
      :title="t('tech.call')"
      class="inline-flex size-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-transparent dark:text-slate-100 dark:hover:bg-slate-800"
    >
      <Phone :class="iconClass || 'size-3.5'" />
      <span class="sr-only">{{ t('tech.call') }}</span>
    </a>
    <a
      :href="whatsappHref(phone)"
      target="_blank"
      rel="noopener noreferrer"
      :title="t('tech.whatsapp')"
      class="inline-flex size-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-transparent dark:text-slate-100 dark:hover:bg-slate-800"
    >
      <MessageCircle :class="iconClass || 'size-3.5'" />
      <span class="sr-only">{{ t('tech.whatsapp') }}</span>
    </a>
  </div>
</template>
