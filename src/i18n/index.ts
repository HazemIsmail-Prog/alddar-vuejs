import { createI18n } from 'vue-i18n'
import en from './en'
import ar from './ar'

export type AppLocale = 'en' | 'ar'

export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: { en, ar },
})

export function named(prefix: string, value?: string | null, fallback?: string | null) {
  if (!value) return fallback || '—'
  const key = `${prefix}.${value}`
  return i18n.global.te(key) ? String(i18n.global.t(key)) : (fallback || value)
}

export type BilingualName = {
  name_en?: string | null
  name_ar?: string | null
} | null | undefined

export type NamedPerson = BilingualName

export function bilingualName(record?: BilingualName, fallback?: string | null) {
  const dash = fallback || '—'
  if (!record) return dash
  const locale = String(i18n.global.locale.value)
  const value = locale === 'ar'
    ? (record.name_ar || record.name_en)
    : (record.name_en || record.name_ar)
  return value || dash
}

export function personName(user?: BilingualName, fallback?: string | null) {
  return bilingualName(user, fallback)
}

export function departmentName(dept?: BilingualName, fallback?: string | null) {
  return bilingualName(dept, fallback)
}

export function statusName(status?: BilingualName, fallback?: string | null) {
  return bilingualName(status, fallback)
}

export function actionLabel(label: string) {
  const key = `search.actions.${label}`
  return i18n.global.te(key) ? String(i18n.global.t(key)) : label
}
