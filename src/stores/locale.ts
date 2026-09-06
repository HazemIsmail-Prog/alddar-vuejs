import { defineStore } from 'pinia'
import { ref } from 'vue'
import { i18n, type AppLocale } from '@/i18n'

function readStored(): AppLocale | null {
  try {
    const value = localStorage.getItem('locale')
    if (value === 'ar' || value === 'en') return value
  } catch {
    /* ignore */
  }
  return null
}

function browserLocale(): AppLocale {
  try {
    if (navigator.language?.toLowerCase().startsWith('ar')) return 'ar'
  } catch {
    /* ignore */
  }
  return 'en'
}

export function applyLocaleDoc(locale: AppLocale) {
  const html = document.documentElement
  html.lang = locale === 'ar' ? 'ar' : 'en'
  html.dir = locale === 'ar' ? 'rtl' : 'ltr'
  i18n.global.locale.value = locale
}

export const useLocaleStore = defineStore('locale', () => {
  const locale = ref<AppLocale>('en')

  function apply(next: AppLocale) {
    locale.value = next
    applyLocaleDoc(next)
    try {
      localStorage.setItem('locale', next)
    } catch {
      /* ignore */
    }
  }

  function toggle() {
    apply(locale.value === 'ar' ? 'en' : 'ar')
  }

  function init() {
    apply(readStored() ?? browserLocale())
  }

  return { locale, apply, toggle, init }
})
