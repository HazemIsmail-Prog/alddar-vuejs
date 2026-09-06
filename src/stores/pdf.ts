import { defineStore } from 'pinia'
import { ref } from 'vue'
import { printPdf, setLetterheadPrintPage } from '@/lib/printPdf'
import { toLetterheadContract } from '@/lib/contractPdf'

export type PdfKind =
  | 'contract-list'
  | 'contract-detail'
  | 'invoice-list'
  | 'invoice-detail'
  | 'payment-list'
  | 'payment-receipt'
  | 'collections-list'

export type PdfDoc = {
  kind: PdfKind
  title: string
  filename: string
  data: Record<string, any>
}

export type ContractTemplateId = 1 | 2 | 3

export type ContractPdfPicker = {
  title: string
  filename: string
  contract: any
}

export const usePdfStore = defineStore('pdf', () => {
  const doc = ref<PdfDoc | null>(null)
  const picker = ref<ContractPdfPicker | null>(null)
  let readyResolve: (() => void) | null = null

  function markReady() {
    readyResolve?.()
    readyResolve = null
  }

  function waitUntilReady(ms = 8000) {
    const ready = new Promise<void>((resolve) => {
      readyResolve = resolve
    })
    const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, ms))
    return Promise.race([ready, timeout])
  }

  function usesLetterhead(kind: PdfKind) {
    return (
      kind === 'contract-detail' ||
      kind === 'invoice-list' ||
      kind === 'invoice-detail' ||
      kind === 'payment-list' ||
      kind === 'payment-receipt'
    )
  }

  async function print(next: PdfDoc) {
    const letterhead = usesLetterhead(next.kind)
    setLetterheadPrintPage(letterhead)
    const waiting = letterhead ? waitUntilReady() : null
    doc.value = next
    if (waiting) await waiting
    await printPdf(next.filename, {
      onAfterPrint: () => setLetterheadPrintPage(false),
    })
  }

  function openContractPicker(payload: ContractPdfPicker) {
    picker.value = payload
  }

  function closeContractPicker() {
    picker.value = null
  }

  async function printPickedTemplate(template: ContractTemplateId) {
    const pending = picker.value
    if (!pending) return
    picker.value = null
    await print({
      kind: 'contract-detail',
      title: pending.title,
      filename: pending.filename,
      data: {
        contract: toLetterheadContract(pending.contract),
        template,
      },
    })
  }

  return {
    doc,
    picker,
    print,
    markReady,
    openContractPicker,
    closeContractPicker,
    printPickedTemplate,
  }
})
