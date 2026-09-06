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
            <tr>
                <td colspan="2" class="!text-end">
                    <span class="font-bold">رقم العقد:</span>
                    {{ contract?.referenceable_number }}
                </td>
            </tr>
            <tr>
                <td colspan="2" class="py-1 !text-center !text-[15px] !font-bold underline">
                    عقد صيانة تكييف مركزى (شامل قطع الغيار بدون الكمبريسور)
                </td>
            </tr>
            <tr>
                <th>الطرف الأول:</th>
                <td>
                    <div class="flex justify-between items-center gap-2">
                        <span>شركة الدار الهندسية للإنشاءات العامة للمباني السكنية</span>
                        <span class="font-bold">ويشار إليه فيما بعد بـ "الطرف الأول"</span>
                    </div>
                </td>
            </tr>
            <tr>
                <th>ويمثلها:</th>
                <td>المهندس/ محمود سالم المهدي، بصفته (مدير وشريك).</td>
            </tr>
            <tr>
                <th>العنوان:</th>
                <td>الضجيج - مجمع دلال سنتر - دور الميزانين - مكتب 15.</td>
            </tr>
            <tr>
                <th>التليفون:</th>
                <td>55920747 - 99254516.</td>
            </tr>
            <tr>
                <th>الطرف الثاني:</th>
                <td>
                    <div class="flex justify-between items-center gap-2">
                        <span>{{ contract?.party?.name }}</span>
                        <span class="font-bold">ويشار إليه فيما بعد بـ "الطرف الثاني"</span>
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
                <td>{{ phones }}</td>
            </tr>
            <tr><th colspan="2">تمهيد</th></tr>
            <tr>
                <td colspan="2">
                    لما كان الطرف الأول يقوم بكافة أعمال خدمات وصيانة التكييف المركزي ، ولرغبة الطرف الثاني إسناد أعمال صيانة التكييف له وبياناتها كالتالي  :-
                </td>
            </tr>
        </table>

        <table :class="kvTableClass" class="[&_td]:border [&_td]:border-border [&_th]:border [&_th]:border-border">
            <tr class="[&_th]:bg-neutral-300 [&_th]:font-bold">
                <th>الرقم الداخلي</th>
                <th>الموديل</th>
                <th>الرقم التسلسلي</th>
            </tr>
            <tr v-for="machine in machines" :key="machine.id">
                <td>{{ machine.internal_number }}</td>
                <td>{{ machine.model }}</td>
                <td>{{ machine.serial_number }}</td>
            </tr>
        </table>

        <table :class="kvTableClass">
            <tr>
                <td colspan="2">فقد اتفق الطرفان على ما يلي:</td>
            </tr>
            <tr>
                <th>أولاً:</th>
                <td>يعتبر التمهيد السابق جزء لا يتجزأ من العقد.</td>
            </tr>
            <tr>
                <th>ثانياً:</th>
                <td>
                    <span>مدة العقد سنة تبدأ اعتباراً من تاريخ</span>
                    <span class="font-bold mx-1">{{ contract?.formatted_contract_start_date }}</span>
                    <span>وتنتهي</span>
                    <span class="font-bold mx-1">{{ contract?.formatted_contract_end_date }}</span>
                    <span>.</span>
                </td>
            </tr>
            <tr>
                <th>ثالثاً:</th>
                <td>
                    للطرف الأول الحق في الطلب من الطرف الثاني تنفيذ الملاحظات التي يرى أنها ضرورية لضمان سير أعمال الصيانة ويكون الطرف الثاني ملزماً بالتقيد لجميع التعليمات والملاحظات وما ينشأ عنها والتي يصدرها إليه الطرف الأول في أي أمر يتعلق بأعمال الصيانة موضوع العقد من أجل توفير الحماية القصوى لماكينات التكييف موضوع العقد.
                </td>
            </tr>
            <tr>
                <th>رابعاً:</th>
                <td>
                    <span>قيمة العقد المستحق للطرف الأول مبلغاً وقدره</span>
                    <span class="font-bold mx-1">{{ contract?.contract_value }}</span>
                    <span>(دينار كويتي فقط).</span>
                </td>
            </tr>
            <tr v-for="payment in payments" :key="payment.id">
                <th></th>
                <td>
                    <ul class="list-disc list-outside ms-4">
                        <li class="space-x-1">
                            <span>{{ payment.notes }}</span>
                            <span>مبلغاً وقدره</span>
                            <span class="font-bold">{{ payment.total_amount }}</span>
                            <span>(دينار كويتي فقط).</span>
                        </li>
                    </ul>
                </td>
            </tr>
            <tr>
                <th>خامساً:</th>
                <td>
                    الالتزامات التعاقدية التي يتعهد الطرف الأول القيام بها على خير وجه وحسب أصول العمل:-
                </td>
            </tr>
            <tr>
                <th></th>
                <td>
                    <ol class="list-decimal list-outside ms-4">
                        <li value="1" class="font-bold">
                            خدمة الصيانة الطارئة:-
                        </li>
                    </ol>
                </td>
            </tr>
            <tr>
                <th></th>
                <td>
                    سوف يقدم الطرف الأول بموجب هذه الاتفاقية خدمة صيانة المكائن ( وحدات ) التكييف المذكورة في الكشف السابق عندما يطلب ذلك الطرف الثاني أو ممثله في العنوان السابق فقط علي الارقام التالية عل مدار الساعة :-
                </td>
            </tr>
            <tr>
                <th></th>
                <td class="!text-center">
                    <span class="inline-block bg-neutral-300 px-4 py-1 font-bold text-red-700">
                        هاتف : 99254516 / نقال : 55920747
                    </span>
                </td>
            </tr>
            <tr>
                <th></th>
                <td>
                    <ol class="list-decimal list-outside ms-4">
                        <li value="2" class="font-bold">
                            خدمة الصيانة الوقائية:-
                        </li>
                    </ol>
                </td>
            </tr>
            <tr>
                <th></th>
                <td>
                    <ul class="list-disc list-outside ms-10 font-normal">
                        <li>تنظيف وغسيل ملفات التبريد والتكثيف بالماء المضغوط.</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <th></th>
                <td>
                    <ul class="list-disc list-outside ms-10 font-normal">
                        <li>فحص كمية غاز التبريد والزيت في الماكينة.</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <th></th>
                <td>
                    <ul class="list-disc list-outside ms-10 font-normal">
                        <li>الكشف على السيور وضبط الشد اذا لم يتم تبديلها.</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <th></th>
                <td>
                    <ul class="list-disc list-outside ms-10 font-normal">
                        <li>فحص وشد الأجزاء الداخلية والخارجية بما فيها الهيكل الخارجي.</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <th></th>
                <td>
                    <ul class="list-disc list-outside ms-10 font-normal">
                        <li>فحص وتنظيف كافة الدوائر الكهربائية والتأكد من سلامتها.</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <th></th>
                <td>
                    <ul class="list-disc list-outside ms-10 font-normal">
                        <li>فحص حسن أداء الكمبريسورات.(والمراوح والمواتير اذا تحتاج لف او تبديل ببرنجات).</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <th></th>
                <td>
                    <ul class="list-disc list-outside ms-10 font-normal">
                        <li>فحص أجهزة الحماية والتأكد من عملها بالطريقة الصحيحة.</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <th></th>
                <td>
                    <ul class="list-disc list-outside ms-10 font-normal">
                        <li>الغسيل الكامل ثلاث مرات سنويا (بعد توقيع العقد وفي منتصف التعاقد وقبل تجديد التعاقد).</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <th></th>
                <td>
                    <ol class="list-decimal list-outside ms-4">
                        <li value="3" class="font-bold">
                            قطع الغيار والمواد والإصلاحات:-
                        </li>
                    </ol>
                </td>
            </tr>
            <tr>
                <th></th>
                <td>
                    سيقوم الطرف الاول بتبديل وإصلاح قطع الغيار فقط بدون الكمبريسور، كما أن هذا التعاقد لن يشمل الإجراءات التالية :-
                </td>
            </tr>
            <tr>
                <th></th>
                <td>
                    <ul class="list-disc list-outside ms-10 font-normal">
                        <li>أي إضافات أو تعديلات أو نقل أو تبديل الماكينات أو أنظمة تكييف الهواء أو أجزاء منها، أو تعديل أي إصلاحات أو إضافات تتم في الماكينات من قبل الغير.</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <th></th>
                <td>
                    <ul class="list-disc list-outside ms-10 font-normal">
                        <li>تكاليف استبدال الماكينة أو الكمبريسور أو الاكسبنشن فالف فـــــي حالة تلف الماكينة أو احتراق الكمبريسور او تلف الاكسبنشن لأي سبب كان ،كما لا يشمل التعاقد (تنظيف الجريلات أو الدفيوزرات أو الدكتات أو العوازل ،كما لا يشمل التعاقد أيضا استبدال الكويلات او الثرموستات أو البايبات أو الألواح الإلكترونية-الاكسبنشن فالف) .</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <th></th>
                <td>
                    <ol class="list-decimal list-outside ms-4">
                        <li value="4" class="font-bold">
                            استبدال الكمبريسور او الاكسبنشن وطريقة الدفع :-
                        </li>
                    </ol>
                </td>
            </tr>
            <tr>
                <th></th>
                <td>
                    <ul class="list-disc list-outside ms-10 font-normal">
                        <li>هذه الاتفاقية لا تشمل استبدال الكمبريسور وملحقاته والاكسبنشن ، ويقوم (الطرف الثاني) بدفع قيمة الكمبريسور أو إعادة إصلاح الكمبريسور إذا ما لزم الأمر أو لعدم وجود بدائل.</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <th></th>
                <td>
                    <ul class="list-disc list-outside ms-10 font-normal">
                        <li>لاستبدال الكمبريسور يقوم (الطرف الثاني) بالموافقة على عرض سعر استبدال الكمبريسور المقدم من (الطرف الأول).</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <th></th>
                <td>
                    <ul class="list-disc list-outside ms-10 font-normal">
                        <li>استبدال الكمبريسور يشمل (قطع الغيار، وغاز التبريد، بالإضافة إلى أجور التركيب).</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <th></th>
                <td>
                    <ul class="list-disc list-outside ms-10 font-normal">
                        <li>يدفع (الطرف الثاني) قيمة الاستبدال فور تقديم عرض السعر والموافقة علية لتم الاستبدال.</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <th>سادساً:</th>
                <td>
                    الطرف الأول غير مسئول عن أي مشاكل في توزيع الهواء داخل المبنى أو عدم كفاية السعة التبريدية لمكائن التكييف لأن ذلك مسئولية الشركة المنفذة لأعمال التركيبات وعلى الطرف الثاني اتخاذ الإجراءات اللازمة لحل تلك المشاكل.
                </td>
            </tr>
            <tr>
                <th>سابعاً:</th>
                <td>يحق للطرفين فسخ العقد في حالة الإخلال بشروط العقد.</td>
            </tr>
            <tr>
                <th>ثامناً:</th>
                <td>
                    يحق للطرف الأول إنهاء الاتفاقية فوراً في الحالات التالية:
                </td>
            </tr>
            <tr>
                <th></th>
                <td>
                    <ol class="list-decimal list-outside ms-6 font-normal">
                        <li value="1">إذا ما وجد أن جهد التيار الكهربائي يزيد أو ينقص عن 415 فولت بمقدار 6%.</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <th></th>
                <td>
                    <ol class="list-decimal list-outside ms-6 font-normal">
                        <li value="2">إذا ما وجد أن الوحدات توجد بها أعطاب ثابتة بسبب سوء الاستعمال أو التقادم الذاتي مما تستوجب التبديل الكامل.</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <th></th>
                <td>
                    <ol class="list-decimal list-outside ms-6 font-normal">
                        <li value="3">ظهور أي ظروف قاهرة لا تمكننا من الوفاء بالتزاماتنا.</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <th>تاسعاً:</th>
                <td>
                    عند إلغاء العقد من جانب الطرف الثاني يحق للطرف الأول بعد احتساب مدة سريان العقد إضافة 10% من قيمة العقد كمصاريف إدارية.
                </td>
            </tr>
            <tr>
                <th>عاشراً:</th>
                <td>
                    تختص المحاكم الكويتية بالنظر في أي نزاع ينشأ حول تنفيذ هذا العقد وتخضع بنوده لأحكام القوانين المعمول بها بدولة الكويت.
                </td>
            </tr>
            <tr>
                <th>الحادي عشر:</th>
                <td>حرر هذا العقد من نسختين بيد كل طرف نسخة للعمل بموجبها.</td>
            </tr>
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
                    <th colspan="2" class="!text-center">الطرف الأول</th>
                    <th colspan="2" class="!text-center">الطرف الثاني</th>
                </tr>
                <tr>
                    <td colspan="2">شركة الدار الهندسية للإنشاءات العامة للمباني</td>
                    <th>الاسم:</th>
                    <!-- <td><div class="border-b border-dotted border-neutral-900 w-[90%]"></div></td> -->
                    <td>{{ contract?.party?.name }}</td>
                </tr>
                <tr>
                    <th>التوقيع:</th>
                    <td><div class="border-b border-dotted border-neutral-900 w-[90%]"></div></td>
                    <th>التوقيع:</th>
                    <td><div class="border-b border-dotted border-neutral-900 w-[90%]"></div></td>
                </tr>
                <tr>
                    <th>التاريخ:</th>
                    <td><div class="border-b border-dotted border-neutral-900 w-[90%]"></div></td>
                    <th>التاريخ:</th>
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
