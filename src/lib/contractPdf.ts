import { formatPhone } from '@/lib/phone'

function fmtDate(value?: string | null) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

export function toLetterheadContract(contract: any) {
  const phones = [...(contract?.client?.phones || [])]
    .sort((a: any, b: any) => Number(b.is_primary) - Number(a.is_primary))
    .map((p: any) => ({ number: formatPhone(p) }))
    .filter((p: { number: string }) => p.number)

  return {
    ...contract,
    party: {
      name: contract?.client?.name || '',
      phones,
    },
    referenceable_number: contract?.id ?? '',
    formatted_contract_start_date: fmtDate(contract?.start_date),
    formatted_contract_end_date: fmtDate(contract?.end_date),
    formatted_compressor_warranty_start_date: fmtDate(contract?.compressor_warranty_start),
    formatted_compressor_warranty_end_date: fmtDate(contract?.compressor_warranty_end),
    contract_value: contract?.total_amount ?? 0,
    machines: (contract?.machines || []).map((m: any) => ({
      id: m.id,
      internal_number: m.brand || '',
      model: m.model || '',
      serial_number: m.serial || '',
    })),
    invoices: (contract?.installments || []).map((row: any) => ({
      id: row.id,
      notes: row.description || fmtDate(row.due_date),
      total_amount: row.amount,
    })),
  }
}
