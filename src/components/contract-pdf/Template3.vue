<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import {
    finishLetterheadSheets,
    letterheadBgStyle,
    letterheadBgUrl,
    letterheadBodyStyle,
    letterheadContentStyle,
    letterheadSheetStyle,
} from '@/lib/letterheadSheet'
const printableBg = letterheadBgUrl

const props = defineProps<{
    contract: any
}>()

const sourceRef = ref<HTMLElement | null>(null)
const pagesRef = ref<HTMLElement | null>(null)

/** `true` = letterhead on every page, `false` = first page only */
const backgroundOnEveryPage = true

/** Contract body font */
const pdfFont = 'Calibri' as 'Cairo' | 'Calibri'

const sheetClass =
    'relative box-border h-[297mm] w-[210mm] overflow-hidden bg-white shadow-lg print:block print:shadow-none print:break-after-page print:last:break-after-auto [print-color-adjust:exact]'
const sheetBgClass =
    'pointer-events-none absolute inset-0 z-0 h-[297mm] w-[210mm] max-w-none object-fill'
const sheetBodyClass =
    'relative z-10 box-border h-[297mm] w-[210mm] overflow-hidden px-[18mm] pb-[40mm] pt-[46mm]'
const sheetContentClass =
    'flex h-full flex-col overflow-hidden text-[15px] leading-[1.8] text-neutral-900 [&>*]:shrink-0'

const debugBorders =
    // 'border border-red-500 [&_td]:border [&_td]:border-red-500 [&_th]:border [&_th]:border-red-500'
    ''

const kvTableClass =
    `mb-2 w-full border-collapse ${debugBorders} [&_td]:min-w-0 [&_td]:text-justify [&_td]:font-normal [&_th]:w-[80px] [&_th]:whitespace-nowrap [&_th]:text-start [&_th]:align-top [&_th]:font-bold`

const overflows = (content: HTMLElement) =>
    content.scrollHeight > content.clientHeight + 1

const createSheet = () => {
    const pages = pagesRef.value
    if (!pages) return null

    const withBackground = backgroundOnEveryPage || pages.childElementCount === 0

    const sheet = document.createElement('section')
    sheet.className = sheetClass
    sheet.style.cssText = letterheadSheetStyle

    const body = document.createElement('div')
    body.className = sheetBodyClass
    body.style.cssText = letterheadBodyStyle

    const content = document.createElement('div')
    content.className = sheetContentClass
    content.style.cssText = letterheadContentStyle
    content.dataset.sheetBody = '1'
    content.style.setProperty('font-family', `'${pdfFont}', sans-serif`, 'important')
    content.setAttribute('dir', 'rtl')
    content.setAttribute('lang', 'ar')

    body.appendChild(content)

    if (withBackground && printableBg) {
        const img = document.createElement('img')
        img.className = sheetBgClass
        img.style.cssText = letterheadBgStyle
        img.src = printableBg
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

const paginate = async () => {
    const source = sourceRef.value
    const pages = pagesRef.value
    if (!source || !pages) return

    pages.replaceChildren()
    await nextTick()

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
        if (block instanceof HTMLTableElement && !block.hasAttribute('data-pin-bottom')) {
            appendTableRows(block)
        } else {
            appendBlock(block)
        }
    }

    finishLetterheadSheets(pages)
}

const location = ref<any>(null)
const phones = ref<any>(null)
const machines = ref<any>(null)
const payments = ref<any>(null)
const isReady = ref(false)


const emit = defineEmits<{ ready: [] }>()

async function prepare() {
    location.value = props.contract?.location || null
    phones.value = (props.contract?.party?.phones || []).map((phone: any) => phone.number).filter(Boolean).join(' - ')
    machines.value = props.contract?.machines || []
    payments.value = props.contract?.invoices || []
    try {
        if (document.fonts?.load) {
            await document.fonts.load(`16px "${pdfFont}"`)
            await document.fonts.load(`700 16px "${pdfFont}"`)
        }
        if (document.fonts?.ready) {
            await document.fonts.ready
        }
    } catch {
        /* Calibri may be missing */
    }
    await nextTick()
    await paginate()
    const pages = pagesRef.value
    if (pages) {
        await Promise.all(
            Array.from(pages.querySelectorAll('img')).map((img) =>
                img.decode ? img.decode().catch(() => undefined) : Promise.resolve(),
            ),
        )
    }
    isReady.value = true
    emit('ready')
}

onMounted(prepare)
</script>

<template>

    <article
        ref="sourceRef"
        class="hidden print:hidden w-[210mm] text-[12.5px] leading-[1.8] text-neutral-900"
        dir="rtl"
        lang="ar"
    >
        <table :class="kvTableClass">
            <tbody>
                <tr>
                    <th>التاريخ</th>
                    <td class="!font-bold">{{ contract?.formatted_contract_start_date }}</td>
                </tr>
                <tr>
                    <th colspan="2">
                        <span>السادة / </span>
                        <span>شركة الدار الهندسية للإنشاءات العامة للمباني السكنية</span>
                    </th>
                </tr>
                <tr>
                    <th colspan="2">
                        <span class="ps-4">تحية طيبة وبعد؛؛؛؛</span>
                    </th>
                </tr>
                <tr>
                    <td colspan="2" class="py-1 !text-center text-[15px] !font-bold underline">
                        الموضوع:-طلب تشغيل مكائن التكييف وكفالة كمبريسور
                    </td>
                </tr>
            </tbody>
        </table>

        <table :class="kvTableClass">
            <tbody>

                <tr>
                    <th>الاسم:</th>
                    <td>
                        <div class="flex justify-between items-center gap-2">
                            <span>{{ contract?.party?.name }}</span>
                        </div>
                    </td>
                </tr>
                <tr>
                    <th>العنوان:</th>
                    <td>
                        <span v-if="location" class="break-words [overflow-wrap:anywhere] flex flex-wrap items-center gap-1">
                            <span v-if="location.country" class="flex items-center gap-1">
                                <span>الدولة</span>
                                <span class="font-bold">{{ location.country }}</span>
                            </span>
                            <span v-if="location.city" class="flex items-center gap-1">
                                <span>المدينة</span>
                                <span class="font-bold">{{ location.city }}</span>
                            </span>
                            <span v-if="location.area" class="flex items-center gap-1">
                                <span>المنطقة</span>
                                <span class="font-bold">{{ location.area }}</span>
                            </span>
                            <span v-if="location.block" class="flex items-center gap-1">
                                <span>القطعة</span>
                                <span class="font-bold">{{ location.block }}</span>
                            </span>
                            <span v-if="location.street" class="flex items-center gap-1">
                                <span>الشارع</span>
                                <span class="font-bold">{{ location.street }}</span>
                            </span>
                            <span v-if="location.avenue" class="flex items-center gap-1">
                                <span>الجادة</span>
                                <span class="font-bold">{{ location.avenue }}</span>
                            </span>
                            <span v-if="location.building" class="flex items-center gap-1">
                                <span>المبنى</span>
                                <span class="font-bold">{{ location.building }}</span>
                            </span>
                            <span v-if="location.floor" class="flex items-center gap-1">
                                <span>الطابق</span>
                                <span class="font-bold">{{ location.floor }}</span>
                            </span>
                            <span v-if="location.flat" class="flex items-center gap-1">
                                <span>الشقة</span>
                                <span class="font-bold">{{ location.flat }}</span>
                            </span>
                        </span>
                    </td>
                </tr>
                <tr>
                    <th>التليفون:</th>
                    <td dir="ltr" class="phone-num">{{ phones }}</td>
                </tr>
                <tr>
                    <th>رقم العقد:</th>
                    <td>{{ contract?.referenceable_number }}</td>
                </tr>
            </tbody>
        </table>

        <table :class="kvTableClass">
            <tbody>
                <tr>
                    <td>
                        بالإشارة الي الموضوع أعلاه  وعلي حسب العقد المبرم بيننا فأنني ارغب بتشغيل مكائن التكييف وبدء الكفالات.
وموديلات المكائن التي تم استلامها كالاتي:-
                    </td>
                </tr>
            </tbody>
        </table>

        <table :class="kvTableClass" class="my-4 [&_td]:border [&_td]:border-border [&_th]:border [&_th]:border-border">
            <thead>
                <tr class="[&_th]:bg-neutral-300 [&_th]:font-bold">
                    <th>الرقم الداخلي</th>
                    <th>الموديل</th>
                    <th>الرقم التسلسلي</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="machine in machines" :key="machine.id">
                    <td>{{ machine.internal_number }}</td>
                    <td>{{ machine.model }}</td>
                    <td>{{ machine.serial_number }}</td>
                </tr>
            </tbody>
        </table>

        <table :class="kvTableClass">
            <tbody>
                <tr>
                    <td> وأنني موافق علي الاتي:-</td>
                </tr>


                <tr>
                    <td>
                        <ol class="list-decimal list-outside ms-4">
                            <li>
                                <span>يتم بدء الكفالة الشاملة وذلك لمدة عام من تاريخ </span>
                                <span class="font-bold">{{ contract?.formatted_contract_start_date }}</span>
                                <span>الي</span>
                                <span class="font-bold">{{ contract?.formatted_contract_end_date }}</span>
                                <span>.</span>
                            </li>
                            <li>
                                <span>يتم بدء كفالة الكمبريسور(5) سنوات من تاريخ توريد مكائن التكييف من تاريخ</span>
                                <span class="font-bold">{{ contract?.formatted_compressor_warranty_start_date }}</span>
                                <span>الي</span>
                                <span class="font-bold">{{ contract?.formatted_compressor_warranty_end_date }}</span>
                                <span>.</span>
                            </li>
                            <li>
                                <span>بعد انتهاء فترة الصيانة المجانية لن تشمل الكفالة أجور تركيب الكمبريسور او أي ملحقات تلزم اثناء استبداله حيث ان الكفالة المقدمة هي كفالة من قبل الوكيل المعتمد في دولة الكويت ويتبع شروط واحكام الشركة المصنعة.</span>
                            </li>
                            <li>
                                <span>التواصل مع قسم صيانة تكييف الدار الهندسية علي (  99254516/ 55920747 ) عادي او ارسال رسالة واتس اب في حالة وجود أي اعطال بالتكييف.</span>
                            </li>
                        </ol>
                    </td>
                </tr>

                <tr>
                    <td class="!font-bold !text-center">وهذا إقرار مني بذلك.</td>
                </tr>
            </tbody>
        </table>

        <table
            data-pin-bottom
            :class="kvTableClass"
            class="mt-auto !mb-0 [&_td]:py-2 [&_th]:py-2 [&_td]:align-middle [&_th]:align-middle"
        >
            <colgroup>
                <col style="width: 8%">
                <col style="width: 42%">
                <col style="width: 8%">
                <col style="width: 42%">
            </colgroup>
            <tbody>
                <tr>
                    <th colspan="2">(المقر بما فيه)</th>
                </tr>
                <tr>
                    <th>الاسم:</th>
                    <td>{{ contract?.party?.name }}</td>
                </tr>
                <tr>
                    <th>التوقيع:</th>
                    <td><div class="border-b border-dotted border-neutral-900 w-[90%]"></div></td>
                </tr>
            </tbody>
        </table>

    </article>

    <div ref="pagesRef" class="flex w-full max-w-full flex-col items-center gap-6 overflow-x-hidden print:block print:w-[210mm] print:gap-0"></div>

</template>

<style>
@page {
    size: A4 portrait;
    margin: 0mm;
}

.contract-pdf,
.contract-pdf :lang(ar),
.contract-pdf [lang='ar'] {
    font-family: var(--pdf-font), sans-serif !important;
}

@media print {
    html,
    body,
    #app {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        print-color-adjust: exact !important;
        -webkit-print-color-adjust: exact !important;
    }
}
</style>
