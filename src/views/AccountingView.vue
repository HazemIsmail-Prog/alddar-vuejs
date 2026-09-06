<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Pencil, Plus } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import { apiError, fmtDate } from '@/lib/utils'
import { named, personName } from '@/i18n'
import { Button } from '@/components/ui/button'
import DeleteButton from '@/components/DeleteButton.vue'
import { Input } from '@/components/ui/input'
import Field from '@/components/ui/Field.vue'
import FormDialog from '@/components/FormDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import AccountingReports from '@/components/AccountingReports.vue'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PageHeader from '@/components/PageHeader.vue'
import ConversationActions from '@/components/ConversationActions.vue'
import { useAuthStore } from '@/stores/auth'

type JournalLineDraft = { key: number; account_id: string; debit: string; credit: string }
type AccountTab = 'reports' | 'chart' | 'journals' | 'trial' | 'valuation' | 'contracts'

const accountTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const

const route = useRoute()
const tab = ref<AccountTab>('reports')
const journals = ref<any[]>([])
const accounts = ref<any[]>([])
const trial = ref<any[]>([])
const trialFrom = ref('')
const trialTo = ref('')
const journalFrom = ref('')
const journalTo = ref('')
const journalSource = ref('')
const ledgerOpen = ref(false)
const ledger = ref<any>(null)
const journalSources = [
  'manual', 'invoice', 'payment', 'payment_allocation', 'contract', 'contract_installment',
  'warehouse_transfer', 'stock_adjustment', 'stock_receipt', 'opening_stock',
]
const valuation = ref<any>({})
const profit = ref<any[]>([])
const journalOpen = ref(false)
const formOpen = ref(false)
const accountOpen = ref(false)
const confirmOpen = ref(false)
const confirmTitle = ref('')
const confirmDescription = ref('')
const confirmAction = ref<null | (() => Promise<void>)>(null)
const selected = ref<any>(null)
const editingId = ref<number | null>(null)
const editingAccountId = ref<number | null>(null)
const editingAccount = ref<any>(null)
const error = ref('')
const saving = ref(false)
const confirming = ref(false)
const running = ref(false)
const accountError = ref('')
const pageError = ref('')
let lineKey = 1
const form = ref(blankForm())
const accountForm = ref(blankAccount())
const { t } = useI18n()
const auth = useAuthStore()

function blankAccount() {
  return { code: '', name: '', type: 'asset', parent_id: '' }
}

function blankLine(): JournalLineDraft {
  return { key: lineKey++, account_id: '', debit: '', credit: '' }
}

function blankForm() {
  return {
    date: new Date().toISOString().slice(0, 10),
    description: '',
    lines: [blankLine(), blankLine()],
  }
}

const debitTotal = computed(() =>
  form.value.lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0),
)
const creditTotal = computed(() =>
  form.value.lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0),
)

async function load() {
  pageError.value = ''
  try {
    const [journalRes, accountRes, trialRes, profitRes] = await Promise.all([
      api.get('/api/journals', { params: { from: journalFrom.value || undefined, to: journalTo.value || undefined, source: journalSource.value || undefined } }),
      api.get('/api/accounts'),
      api.get('/api/trial-balance', { params: { from: trialFrom.value || undefined, to: trialTo.value || undefined } }),
      api.get('/api/contracts-profit'),
    ])
    journals.value = journalRes.data
    accounts.value = accountRes.data
    trial.value = trialRes.data
    profit.value = profitRes.data
  } catch (e) {
    pageError.value = apiError(e)
  }
  try {
    valuation.value = (await api.get('/api/inventory/valuation')).data
  } catch {
    valuation.value = { rows: [] }
  }
}

async function run() {
  if (running.value) return
  running.value = true
  try {
    await load()
  } finally {
    running.value = false
  }
}

onMounted(async () => {
  if (route.query.tab === 'journals' || route.query.tab === 'chart' || route.query.tab === 'trial' || route.query.tab === 'valuation' || route.query.tab === 'contracts' || route.query.tab === 'reports') {
    tab.value = route.query.tab
  }
  await load()
  const id = Number(route.query.id)
  if (id) {
    const row = journals.value.find((item: any) => item.id === id)
    if (row) openJournal(row)
  }
})

function openJournal(j: any) {
  selected.value = j
  journalOpen.value = true
}

function startCreate() {
  editingId.value = null
  form.value = blankForm()
  error.value = ''
  formOpen.value = true
}

function startEdit(j: any) {
  editingId.value = j.id
  lineKey = 1
  form.value = {
    date: fmtDate(j.date),
    description: j.description || '',
    lines: (j.lines || []).map((l: any) => ({
      key: lineKey++,
      account_id: String(l.account_id),
      debit: l.debit ? String(l.debit) : '',
      credit: l.credit ? String(l.credit) : '',
    })),
  }
  if (form.value.lines.length < 2) form.value.lines.push(blankLine())
  error.value = ''
  journalOpen.value = false
  formOpen.value = true
}

function addLine() {
  form.value.lines.push(blankLine())
}

function removeLine(index: number) {
  if (form.value.lines.length <= 2) {
    form.value.lines[index] = blankLine()
    return
  }
  form.value.lines.splice(index, 1)
}

function setDebit(line: JournalLineDraft, value: string) {
  line.debit = value
  if (Number(value) > 0) line.credit = ''
}

function setCredit(line: JournalLineDraft, value: string) {
  line.credit = value
  if (Number(value) > 0) line.debit = ''
}

function payloadLines() {
  return form.value.lines
    .map((line) => ({
      account_id: Number(line.account_id),
      debit: Number(line.debit) || 0,
      credit: Number(line.credit) || 0,
    }))
    .filter((line) => line.account_id && (line.debit > 0 || line.credit > 0))
}

async function submitJournal() {
  if (saving.value) return
  error.value = ''
  const lines = payloadLines()
  if (lines.length < 2) {
    error.value = t('accounting.needLines')
    return
  }
  if (lines.some((line) => line.debit > 0 && line.credit > 0)) {
    error.value = t('accounting.bothSides')
    return
  }
  const debit = lines.reduce((sum, line) => sum + line.debit, 0)
  const credit = lines.reduce((sum, line) => sum + line.credit, 0)
  if (debit !== credit) {
    error.value = t('accounting.unbalanced')
    return
  }
  saving.value = true
  try {
    const body = {
      date: form.value.date,
      description: form.value.description.trim(),
      lines,
    }
    if (editingId.value) {
      await api.put(`/api/journals/${editingId.value}`, body)
    } else {
      await api.post('/api/journals', body)
    }
    formOpen.value = false
    await load()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}

const tabs = [
  { id: 'reports', labelKey: 'accounting.reports' },
  { id: 'chart', labelKey: 'accounting.chart' },
  { id: 'trial', labelKey: 'accounting.trial' },
  { id: 'journals', labelKey: 'accounting.journals' },
  { id: 'valuation', labelKey: 'accounting.inventory' },
  { id: 'contracts', labelKey: 'accounting.contractCost' },
] as const

function money(n?: number | null) {
  return Number(n || 0).toLocaleString()
}

async function openLedger(row: any) {
  pageError.value = ''
  try {
    const { data } = await api.get(`/api/accounts/${row.id}/ledger`, {
      params: { from: trialFrom.value || undefined, to: trialTo.value || undefined },
    })
    ledger.value = data
    ledgerOpen.value = true
  } catch (e) {
    pageError.value = apiError(e)
  }
}

const parentOptions = computed(() =>
  accounts.value.filter((a) => a.id !== editingAccountId.value),
)

const systemLocked = computed(() => Boolean(editingAccount.value?.is_system))

function startCreateAccount() {
  editingAccountId.value = null
  editingAccount.value = null
  accountForm.value = blankAccount()
  accountError.value = ''
  accountOpen.value = true
}

function startEditAccount(account: any) {
  editingAccountId.value = account.id
  editingAccount.value = account
  accountForm.value = {
    code: account.code || '',
    name: account.name || '',
    type: account.type || 'asset',
    parent_id: account.parent_id ? String(account.parent_id) : '',
  }
  accountError.value = ''
  accountOpen.value = true
}

function canDeleteAccount(account: any) {
  return !account.is_system && !account.lines_count && !account.children_count
}

function askDeleteAccount(account: any) {
  ask(
    t('accounting.deleteAccount'),
    t('accounting.deleteAccountDesc'),
    () => api.delete(`/api/accounts/${account.id}`),
  )
}

function askDeleteJournal(journal: any) {
  journalOpen.value = false
  ask(
    t('accounting.deleteJournal'),
    t('accounting.deleteJournalDesc'),
    () => api.delete(`/api/journals/${journal.id}`),
  )
}

function ask(title: string, description: string, fn: () => Promise<unknown>) {
  confirmTitle.value = title
  confirmDescription.value = description
  confirmAction.value = async () => {
    await fn()
  }
  confirmOpen.value = true
}

async function runConfirm() {
  if (!confirmAction.value || confirming.value) return
  confirming.value = true
  try {
    await confirmAction.value()
    confirmOpen.value = false
    await load()
  } catch (e) {
    pageError.value = apiError(e)
    confirmOpen.value = false
  } finally {
    confirming.value = false
  }
}

async function submitAccount() {
  if (saving.value) return
  accountError.value = ''
  saving.value = true
  try {
    const body = {
      code: accountForm.value.code.trim(),
      name: accountForm.value.name.trim(),
      type: accountForm.value.type,
      parent_id: accountForm.value.parent_id ? Number(accountForm.value.parent_id) : null,
    }
    if (editingAccountId.value) {
      await api.put(`/api/accounts/${editingAccountId.value}`, body)
    } else {
      await api.post('/api/accounts', body)
    }
    accountOpen.value = false
    await load()
  } catch (e) {
    accountError.value = apiError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader :title="t('accounting.title')" :subtitle="t('accounting.subtitle')" />
    <p v-if="pageError" class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      {{ pageError }}
    </p>

    <div class="page-tabs">
      <button
        v-for="tabItem in tabs"
        :key="tabItem.id"
        type="button"
        class="page-tab"
        :class="tab === tabItem.id && 'is-active'"
        @click="tab = tabItem.id"
      >
        {{ t(tabItem.labelKey) }}
      </button>
    </div>

    <AccountingReports v-if="tab === 'reports'" :accounts="accounts" />

    <div v-else-if="tab === 'chart'" class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-slate-500">{{ t('accounting.lockedHint') }}</p>
        <Button v-if="auth.can('accounting.create')" @click="startCreateAccount">
          <Plus class="size-4" /> {{ t('accounting.newAccount') }}
        </Button>
      </div>
      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t('accounting.code') }}</th>
              <th>{{ t('accounting.name') }}</th>
              <th>{{ t('common.type') }}</th>
              <th>{{ t('common.status') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in accounts" :key="a.id">
              <td class="font-medium">{{ a.code }}</td>
              <td>{{ a.name }}</td>
              <td>{{ named('accountType', a.type) }}</td>
              <td>
                <Badge :variant="a.is_system ? 'secondary' : 'default'">
                  {{ a.is_system ? t('accounting.systemAccount') : t('accounting.customAccount') }}
                </Badge>
              </td>
              <td class="text-end whitespace-nowrap">
                <Button
                  v-if="auth.can('accounting.update')"
                  size="sm"
                  variant="outline"
                  class="me-1"
                  @click="startEditAccount(a)"
                >
                  <Pencil class="size-3.5" /> {{ t('common.edit') }}
                </Button>
                <DeleteButton
                  v-if="canDeleteAccount(a) && auth.can('accounting.delete')"
                  @click="askDeleteAccount(a)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else-if="tab === 'trial'" class="space-y-3">
      <div class="flex flex-wrap items-end gap-3">
        <Field :label="t('accounting.from')"><Input v-model="trialFrom" type="date" /></Field>
        <Field :label="t('accounting.to')"><Input v-model="trialTo" type="date" /></Field>
        <Button variant="outline" :loading="running" @click="run">{{ t('accounting.run') }}</Button>
      </div>
      <p class="text-sm text-slate-500">{{ t('accounting.clickLedger') }}</p>
      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t('accounting.code') }}</th>
              <th>{{ t('accounting.name') }}</th>
              <th class="text-end">{{ t('accounting.opening') }}</th>
              <th class="text-end">{{ t('accounting.debit') }}</th>
              <th class="text-end">{{ t('accounting.credit') }}</th>
              <th class="text-end">{{ t('accounting.balance') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in trial" :key="r.code" class="cursor-pointer hover:bg-slate-50" @click="openLedger(r)">
              <td class="font-medium">{{ r.code }}</td>
              <td>{{ r.name }}</td>
              <td class="text-end">{{ money(r.opening) }}</td>
              <td class="text-end">{{ money(r.debit) }}</td>
              <td class="text-end">{{ money(r.credit) }}</td>
              <td class="text-end font-medium">{{ money(r.balance) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else-if="tab === 'journals'" class="space-y-3">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div class="flex flex-wrap items-end gap-3">
          <Field :label="t('accounting.from')"><Input v-model="journalFrom" type="date" /></Field>
          <Field :label="t('accounting.to')"><Input v-model="journalTo" type="date" /></Field>
          <Field :label="t('accounting.source')">
            <select v-model="journalSource" class="select">
              <option value="">{{ t('accounting.allSources') }}</option>
              <option v-for="source in journalSources" :key="source" :value="source">{{ named('journalSource', source) }}</option>
            </select>
          </Field>
          <Button variant="outline" :loading="running" @click="run">{{ t('accounting.run') }}</Button>
        </div>
        <Button v-if="auth.can('accounting.create')" @click="startCreate">
          <Plus class="size-4" /> {{ t('accounting.newJournal') }}
        </Button>
      </div>
      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t('accounting.date') }}</th>
              <th>{{ t('accounting.description') }}</th>
              <th>{{ t('accounting.source') }}</th>
              <th>{{ t('accounting.postedBy') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="j in journals" :key="j.id">
              <td class="whitespace-nowrap">{{ fmtDate(j.date) }}</td>
              <td>{{ j.description }}</td>
              <td>
                <Badge :variant="j.is_manual ? 'default' : 'secondary'">{{ named('journalSource', j.source_type) }}</Badge>
              </td>
              <td>{{ personName(j.poster, t('common.system')) }}</td>
              <td class="text-end whitespace-nowrap">
                <Button size="sm" variant="outline" class="me-1" @click="openJournal(j)">{{ t('accounting.lines') }}</Button>
                <Button
                  v-if="j.is_manual && auth.can('accounting.update')"
                  size="sm"
                  variant="outline"
                  class="me-1"
                  @click="startEdit(j)"
                >
                  <Pencil class="size-3.5" /> {{ t('common.edit') }}
                </Button>
                <DeleteButton
                  v-if="j.is_manual && auth.can('accounting.delete')"
                  @click="askDeleteJournal(j)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Card v-else-if="tab === 'valuation'">
      <CardContent class="p-5">
        <div class="mb-4 grid gap-3 sm:grid-cols-4">
          <div class="rounded-lg bg-slate-50 p-3 text-sm"><p class="text-slate-500">{{ t('accounting.onHand') }}</p><p class="font-semibold">{{ valuation.on_hand_value }}</p></div>
          <div class="rounded-lg bg-slate-50 p-3 text-sm"><p class="text-slate-500">{{ t('accounting.inTransit') }}</p><p class="font-semibold">{{ valuation.in_transit_value }}</p></div>
          <div class="rounded-lg bg-slate-50 p-3 text-sm"><p class="text-slate-500">{{ t('accounting.glInventory') }}</p><p class="font-semibold">{{ valuation.gl_inventory }}</p></div>
          <div class="rounded-lg bg-slate-50 p-3 text-sm"><p class="text-slate-500">{{ t('accounting.glTransit') }}</p><p class="font-semibold">{{ valuation.gl_in_transit }}</p></div>
        </div>
        <table class="data-table">
          <thead><tr><th>{{ t('inventory.warehouse') }}</th><th>{{ t('common.item') }}</th><th>{{ t('common.qty') }}</th><th>{{ t('contracts.value') }}</th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in valuation.rows || []" :key="i">
              <td>{{ r.warehouse }}</td>
              <td>{{ r.item }}</td>
              <td>{{ r.qty }}</td>
              <td>{{ r.value }}</td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>

    <div v-else-if="tab === 'contracts'" class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
      <table class="data-table">
        <thead><tr><th>{{ t('common.client') }}</th><th>{{ t('common.type') }}</th><th>{{ t('contracts.value') }}</th><th>{{ t('accounting.fulfillment') }}</th></tr></thead>
        <tbody>
          <tr v-for="c in profit" :key="c.id">
            <td>{{ c.client }}</td>
            <td>{{ c.type }}</td>
            <td>{{ c.value }}</td>
            <td>{{ c.fulfillment_cost }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <FormDialog v-model:open="journalOpen" :title="selected?.description || t('accounting.journal')" wide hide-submit>
      <template #header-extra>
        <ConversationActions v-if="selected?.id" type="journal" :id="selected.id" class="mt-2" />
      </template>
      <p class="text-sm text-slate-500">
        {{ fmtDate(selected?.date) }}
        · {{ named('journalSource', selected?.source_type) }}
        · {{ personName(selected?.poster, t('common.system')) }}
      </p>
      <table class="data-table">
        <thead><tr><th>{{ t('accounting.account') }}</th><th>{{ t('accounting.debit') }}</th><th>{{ t('accounting.credit') }}</th></tr></thead>
        <tbody>
          <tr v-for="l in selected?.lines || []" :key="l.id">
            <td>{{ l.account?.code }} {{ l.account?.name }}</td>
            <td>{{ l.debit }}</td>
            <td>{{ l.credit }}</td>
          </tr>
        </tbody>
      </table>
      <div class="flex flex-wrap gap-2">
        <Button
          v-if="selected?.is_manual && auth.can('accounting.update')"
          type="button"
          variant="outline"
          @click="startEdit(selected)"
        >
          <Pencil class="size-4" /> {{ t('accounting.editJournal') }}
        </Button>
        <DeleteButton
          v-if="selected?.is_manual && auth.can('accounting.delete')"
          :label="t('accounting.deleteJournal')"
          @click="askDeleteJournal(selected)"
        />
      </div>
    </FormDialog>

    <FormDialog
      v-model:open="ledgerOpen"
      :title="ledger?.account ? `${ledger.account.code} ${ledger.account.name}` : t('accounting.reportLedger')"
      wide
      hide-submit
    >
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t('accounting.date') }}</th>
            <th>{{ t('accounting.description') }}</th>
            <th>{{ t('accounting.source') }}</th>
            <th class="text-end">{{ t('accounting.debit') }}</th>
            <th class="text-end">{{ t('accounting.credit') }}</th>
            <th class="text-end">{{ t('accounting.balance') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr class="bg-slate-50">
            <td colspan="5">{{ t('accounting.opening') }}</td>
            <td class="text-end">{{ money(ledger?.opening) }}</td>
          </tr>
          <tr v-for="line in ledger?.lines || []" :key="line.id">
            <td class="whitespace-nowrap">{{ line.date }}</td>
            <td>{{ line.description }}</td>
            <td>{{ named('journalSource', line.source_type) }}</td>
            <td class="text-end">{{ line.debit ? money(line.debit) : '' }}</td>
            <td class="text-end">{{ line.credit ? money(line.credit) : '' }}</td>
            <td class="text-end">{{ money(line.balance) }}</td>
          </tr>
          <tr class="bg-slate-100 font-semibold">
            <td colspan="5">{{ t('accounting.closing') }}</td>
            <td class="text-end">{{ money(ledger?.closing) }}</td>
          </tr>
        </tbody>
      </table>
    </FormDialog>

    <FormDialog
      v-model:open="accountOpen"
      :title="editingAccountId ? t('accounting.editAccount') : t('accounting.newAccount')"
      :description="systemLocked ? t('accounting.renameOnly') : undefined"
      :submit-label="t('common.save')"
      :error="accountError"
      :loading="saving"
      @submit="submitAccount"
    >
      <div class="grid gap-3 sm:grid-cols-2">
        <Field :label="t('accounting.code')">
          <Input v-model="accountForm.code" :disabled="systemLocked" required />
        </Field>
        <Field :label="t('accounting.name')">
          <Input v-model="accountForm.name" required />
        </Field>
        <Field :label="t('common.type')">
          <select v-model="accountForm.type" class="select" :disabled="systemLocked" required>
            <option v-for="type in accountTypes" :key="type" :value="type">{{ named('accountType', type) }}</option>
          </select>
        </Field>
        <Field :label="t('accounting.parent')">
          <select v-model="accountForm.parent_id" class="select" :disabled="systemLocked">
            <option value="">{{ t('accounting.noParent') }}</option>
            <option v-for="a in parentOptions" :key="a.id" :value="String(a.id)">{{ a.code }} {{ a.name }}</option>
          </select>
        </Field>
      </div>
    </FormDialog>

    <ConfirmDialog
      v-model:open="confirmOpen"
      :title="confirmTitle"
      :description="confirmDescription"
      :confirm-label="t('common.delete')"
      variant="destructive"
      :loading="confirming"
      @confirm="runConfirm"
    />

    <FormDialog
      v-model:open="formOpen"
      :title="editingId ? t('accounting.editJournal') : t('accounting.newJournal')"
      wide
      :submit-label="t('common.save')"
      :error="error"
      :loading="saving"
      @submit="submitJournal"
    >
      <div class="grid gap-3 sm:grid-cols-2">
        <Field :label="t('accounting.date')"><Input v-model="form.date" type="date" required /></Field>
        <Field :label="t('accounting.description')"><Input v-model="form.description" required /></Field>
      </div>
      <div class="space-y-2">
        <div v-for="(line, i) in form.lines" :key="line.key" class="grid grid-cols-[1fr_6rem_6rem_auto] items-center gap-2">
          <select v-model="line.account_id" class="select">
            <option value="">{{ t('accounting.account') }}</option>
            <option v-for="a in accounts" :key="a.id" :value="String(a.id)">{{ a.code }} {{ a.name }}</option>
          </select>
          <Input :model-value="line.debit" type="number" min="0" step="1" :placeholder="t('accounting.debit')" @update:model-value="setDebit(line, String($event ?? ''))" />
          <Input :model-value="line.credit" type="number" min="0" step="1" :placeholder="t('accounting.credit')" @update:model-value="setCredit(line, String($event ?? ''))" />
          <DeleteButton icon-only @click="removeLine(i)" />
        </div>
        <div class="flex items-center justify-between gap-3">
          <Button type="button" size="sm" variant="outline" @click="addLine">
            <Plus class="size-3.5" /> {{ t('accounting.addLine') }}
          </Button>
          <p class="text-sm" :class="debitTotal === creditTotal ? 'text-slate-500' : 'text-red-600'">
            {{ t('accounting.totals') }}
            {{ t('accounting.debit') }} {{ debitTotal }}
            ·
            {{ t('accounting.credit') }} {{ creditTotal }}
          </p>
        </div>
      </div>
    </FormDialog>
  </div>
</template>
