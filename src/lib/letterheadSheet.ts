import letterheadBgUrl from '@/assets/images/printable_bg.jpg'

export { letterheadBgUrl }

/** Inline print layout so sheets don’t depend on Tailwind surviving on created nodes. */

export const letterheadSheetStyle =
  'position:relative;box-sizing:border-box;width:210mm;height:297mm;overflow:hidden;background:#fff;break-after:page;page-break-after:always;break-inside:avoid;page-break-inside:avoid;print-color-adjust:exact;-webkit-print-color-adjust:exact;'

export const letterheadBgStyle =
  'position:absolute;left:0;top:0;z-index:0;width:210mm;height:297mm;max-width:none;object-fit:fill;pointer-events:none;'

export const letterheadBodyStyle =
  'position:relative;z-index:1;box-sizing:border-box;width:210mm;height:297mm;overflow:hidden;padding:46mm 18mm 40mm;'

export const letterheadContentStyle =
  'display:flex;flex-direction:column;height:100%;overflow:hidden;font-size:15px;line-height:1.8;color:#171717;'

export async function paginateIntoLetterhead(
  source: HTMLElement,
  pages: HTMLElement,
  options?: { dir?: string; lang?: string; font?: string; fontSize?: string; lineHeight?: string },
) {
  const dir = options?.dir || 'ltr'
  const overflows = (el: HTMLElement) => el.scrollHeight > el.clientHeight + 1

  const createSheet = () => {
    const sheet = document.createElement('section')
    sheet.style.cssText = letterheadSheetStyle

    const body = document.createElement('div')
    body.style.cssText = letterheadBodyStyle

    const content = document.createElement('div')
    content.style.cssText = letterheadContentStyle
    if (options?.fontSize) content.style.fontSize = options.fontSize
    if (options?.lineHeight) content.style.lineHeight = options.lineHeight
    content.dataset.sheetBody = '1'
    content.setAttribute('dir', dir)
    if (options?.lang) content.setAttribute('lang', options.lang)
    if (options?.font) content.style.setProperty('font-family', options.font, 'important')

    body.appendChild(content)

    if (letterheadBgUrl) {
      const img = document.createElement('img')
      img.style.cssText = letterheadBgStyle
      img.src = letterheadBgUrl
      img.alt = ''
      img.setAttribute('aria-hidden', 'true')
      sheet.append(img, body)
    } else {
      sheet.append(body)
    }

    pages.appendChild(sheet)
    return content
  }

  const cloneTableShell = (table: HTMLTableElement) => {
    const next = table.cloneNode(false) as HTMLTableElement
    const colgroup = table.querySelector('colgroup')
    if (colgroup) next.appendChild(colgroup.cloneNode(true))
    const tbody = document.createElement('tbody')
    next.appendChild(tbody)
    return { table: next, tbody }
  }

  pages.replaceChildren()
  const blocks = Array.from(source.children)
  let body = createSheet()
  if (!body) return

  const startNewSheet = () => {
    const next = createSheet()
    if (!next) return body
    body = next
    return body
  }

  const appendTableRows = (table: HTMLTableElement) => {
    const rows = Array.from(table.rows)
    let { table: currentTable, tbody } = cloneTableShell(table)
    body?.appendChild(currentTable)

    for (const row of rows) {
      tbody.appendChild(row)
      if (!overflows(body!)) continue

      if (tbody.rows.length > 1) {
        tbody.removeChild(row)
        startNewSheet()
        ;({ table: currentTable, tbody } = cloneTableShell(table))
        body?.appendChild(currentTable)
        tbody.appendChild(row)
      } else if (body!.children.length > 1) {
        body!.removeChild(currentTable)
        startNewSheet()
        body?.appendChild(currentTable)
      }
    }
  }

  const appendBlock = (block: Element) => {
    if (!body) return
    body.appendChild(block)
    if (overflows(body) && body.children.length > 1) {
      body.removeChild(block)
      startNewSheet()?.appendChild(block)
    }
  }

  for (const block of blocks) {
    if (block instanceof HTMLTableElement) appendTableRows(block)
    else appendBlock(block)
  }

  finishLetterheadSheets(pages)

  await Promise.all(
    Array.from(pages.querySelectorAll('img')).map((img) =>
      (img as HTMLImageElement).decode ? img.decode().catch(() => undefined) : Promise.resolve(),
    ),
  )
}

export function finishLetterheadSheets(pages: HTMLElement) {
  for (const sheet of Array.from(pages.children)) {
    const content = sheet.querySelector('[data-sheet-body]')
    if (!content || content.childElementCount === 0) sheet.remove()
  }
  const sheets = Array.from(pages.children) as HTMLElement[]
  sheets.forEach((sheet, i) => {
    const last = i === sheets.length - 1
    sheet.style.breakAfter = last ? 'auto' : 'page'
    sheet.style.pageBreakAfter = last ? 'auto' : 'always'
    sheet.style.breakBefore = 'auto'
    sheet.style.pageBreakBefore = 'auto'
  })
}
