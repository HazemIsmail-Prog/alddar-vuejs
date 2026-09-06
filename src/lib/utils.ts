import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { i18n } from '@/i18n'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function contrastText(hex: string) {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  if (Number.isNaN(n)) return '#ffffff'
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (r * 299 + g * 587 + b * 114) / 1000 >= 160 ? '#0f172a' : '#ffffff'
}

export function statusBadgeStyle(hex?: string | null) {
  const color = hex && /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : '#64748B'
  return {
    backgroundColor: color,
    color: contrastText(color),
  }
}

export function statusCardStyle(hex?: string | null) {
  const color = hex && /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : '#64748B'
  return {
    borderColor: color,
    backgroundColor: `light-dark(color-mix(in srgb, ${color} 16%, white), color-mix(in srgb, ${color} 28%, #151c2c))`,
  }
}

export function apiError(e: unknown) {
  const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
  return (
    err.response?.data?.message ??
    Object.values(err.response?.data?.errors ?? {})[0]?.[0] ??
    String(i18n.global.t('common.somethingWrong'))
  )
}

export function fmtDate(value?: string | null, fallback?: string) {
  if (!value) return fallback ?? String(i18n.global.t('common.dash'))
  return String(value).slice(0, 10)
}

export function remainingAmountClass(amount: number) {
  return amount > 0
    ? 'font-medium tabular-nums text-amber-800 dark:text-amber-200'
    : 'tabular-nums text-slate-500'
}
