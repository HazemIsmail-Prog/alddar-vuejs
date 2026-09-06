export function orderInvoices(order: any): any[] {
  if (!order) return []
  const rows = Array.isArray(order.invoices) && order.invoices.length
    ? order.invoices
    : (order.invoice ? [order.invoice] : [])
  return rows.filter((invoice: any) => invoice && invoice.status !== 'voided')
}

export function orderDraftInvoice(order: any) {
  return orderInvoices(order).find((invoice: any) => invoice.status === 'draft') ?? null
}

export function orderHasInvoice(order: any) {
  return orderInvoices(order).length > 0
}

export function invoicePaidAmount(invoice: any) {
  if (Array.isArray(invoice?.allocations)) {
    return invoice.allocations.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0)
  }
  return Number(invoice?.paid || 0)
}

export function invoiceRemaining(invoice: any) {
  if (!invoice || invoice.status !== 'confirmed') return 0
  return Math.max(0, Number(invoice.total || 0) - invoicePaidAmount(invoice))
}

export function invoiceCanDelete(invoice: any, allowConfirmed = false) {
  if (!invoice) return false
  if (invoice.status === 'draft' || invoice.status === 'voided') return true
  if (!allowConfirmed || invoice.status !== 'confirmed') return false
  return invoicePaidAmount(invoice) <= 0
}
