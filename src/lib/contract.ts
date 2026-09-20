export function contractRef(contract: { id?: number | string; reference_no?: string | null } | null | undefined): string {
  if (!contract) return ''
  if (contract.reference_no) return contract.reference_no

  return contract.id != null && contract.id !== '' ? `#${contract.id}` : ''
}