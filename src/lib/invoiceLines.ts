export const CUSTOM_ITEM = '__custom__'

export type InvoiceEditLine = {
  key: number
  item_id: string
  description: string
  quantity: string
  unit_amount: string
  machine_id: string
  is_covered: boolean
  coveredTouched?: boolean
}

let lineKey = 1

export function blankInvoiceLine(): InvoiceEditLine {
  return {
    key: lineKey++,
    item_id: '',
    description: '',
    quantity: '1',
    unit_amount: '0',
    machine_id: '',
    is_covered: false,
    coveredTouched: false,
  }
}

export function linesFromInvoice(items: any[] | undefined): InvoiceEditLine[] {
  if (!items?.length) return [blankInvoiceLine()]
  return items.map((line) => ({
    key: lineKey++,
    item_id: line.item_id ? String(line.item_id) : CUSTOM_ITEM,
    description: line.description || '',
    quantity: String(line.quantity ?? '1'),
    unit_amount: String(line.unit_amount ?? '0'),
    machine_id: line.machine_id ? String(line.machine_id) : '',
    is_covered: Boolean(line.is_covered),
    coveredTouched: true,
  }))
}

export function isCustomLine(line: InvoiceEditLine) {
  return line.item_id === CUSTOM_ITEM
}

export function setLineKind(line: InvoiceEditLine, kind: 'catalog' | 'custom') {
  if (kind === 'custom') {
    line.item_id = CUSTOM_ITEM
    return
  }
  if (line.item_id === CUSTOM_ITEM) {
    line.item_id = ''
    line.description = ''
  }
}

export function invoiceLinesPayload(lines: InvoiceEditLine[], withPrice = false) {
  return lines
    .filter((line) => Number(line.quantity) > 0 && (isCustomLine(line) ? line.description.trim() : line.item_id))
    .map((line) => {
      const payload: Record<string, unknown> = {
        quantity: Number(line.quantity),
        machine_id: line.machine_id ? Number(line.machine_id) : null,
        is_covered: Boolean(line.is_covered),
      }
      if (withPrice) payload.unit_amount = Math.max(0, Number(line.unit_amount) || 0)
      if (isCustomLine(line)) {
        payload.item_id = null
        payload.description = line.description.trim()
        return payload
      }
      payload.item_id = Number(line.item_id)
      return payload
    })
}
