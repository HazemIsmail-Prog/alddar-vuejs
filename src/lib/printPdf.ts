import { nextTick } from 'vue'

const LETTERHEAD_PAGE_STYLE_ID = 'letterhead-print-page'

export type LetterheadPrint = false | 'sheet'

export function setLetterheadPrintPage(on: boolean) {
  document.getElementById(LETTERHEAD_PAGE_STYLE_ID)?.remove()
  document.documentElement.classList.toggle('printing-letterhead', on)
  document.documentElement.classList.toggle('printing-contract', on)
  if (!on) return
  const el = document.createElement('style')
  el.id = LETTERHEAD_PAGE_STYLE_ID
  el.textContent = [
    '@page { size: A4 portrait; margin: 0; }',
    'html, body { margin: 0 !important; padding: 0 !important; }',
    '#app { display: none !important; }',
  ].join('\n')
  document.head.appendChild(el)
}

export async function printPdf(filename: string, options?: { onAfterPrint?: () => void }) {
  await nextTick()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  const prev = document.title
  document.title = filename
  const done = () => {
    document.title = prev
    window.removeEventListener('afterprint', done)
    options?.onAfterPrint?.()
  }
  window.addEventListener('afterprint', done)
  window.print()
}
