import { i18n, named } from '@/i18n'

export type PaymentMethodRow = {
  method?: string | null
  payment?: { method?: string | null } | null
}

export function paymentMethodLabel(row: PaymentMethodRow) {
  if (row.method === 'credit') return String(i18n.global.t('clients.asCredit'))
  if (row.payment) return named('tech', row.payment.method, row.payment.method)
  if (row.method) return named('tech', row.method, row.method)
  return String(i18n.global.t('clients.asCredit'))
}

export function dueTone(
  row: { due_date?: string | null; remaining?: number },
  today: string,
  remainingAmount = Number(row.remaining || 0),
): '' | 'overdue' | 'today' {
  if (remainingAmount <= 0) return ''
  const due = String(row.due_date || '').slice(0, 10)
  if (!due) return ''
  if (due < today) return 'overdue'
  if (due === today) return 'today'
  return ''
}
