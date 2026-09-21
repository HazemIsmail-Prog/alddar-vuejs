export function contractRef(contract: { id?: number | string; reference_no?: string | null } | null | undefined): string {
  if (!contract) return ''
  if (contract.reference_no) return contract.reference_no

  return contract.id != null && contract.id !== '' ? `#${contract.id}` : ''
}

export function daysUntilEnd(contract: { end_date?: string | null } | null | undefined, today = new Date()): number | null {
  if (!contract?.end_date) return null

  const end = /T/.test(contract.end_date)
    ? new Date(contract.end_date)
    : new Date(`${contract.end_date}T00:00:00`)
  if (Number.isNaN(end.getTime())) return null

  const diff = Math.round((end.getTime() - today.getTime()) / 86_400_000)
  return diff >= 0 ? diff : null
}