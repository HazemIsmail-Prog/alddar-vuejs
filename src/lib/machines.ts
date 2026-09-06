import { i18n } from '@/i18n'

export type MachineLike = {
  brand?: string | null
  model?: string | null
  serial?: string | null
} | null | undefined

export function machineLabel(machine?: MachineLike, opts?: { includeSerial?: boolean }) {
  const fallback = String(i18n.global.t('clients.machine'))
  if (!machine) return opts?.includeSerial ? String(i18n.global.t('common.dash')) : fallback
  const name = [machine.brand, machine.model].filter(Boolean).join(' ')
  if (!opts?.includeSerial) return name || fallback
  return [name || fallback, machine.serial].filter(Boolean).join(' · ')
}
