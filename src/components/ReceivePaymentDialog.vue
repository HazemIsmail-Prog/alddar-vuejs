<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '@/api/client'
import { apiError } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import Field from '@/components/ui/Field.vue'
import FormDialog from '@/components/FormDialog.vue'

export type PaymentDue = {
  type: 'invoice' | 'installment'
  id: number
  remaining: number
  label: string
}

export type PaymentPreset = { type: 'credit' } | { type: 'invoice' | 'installment'; id: number }

const props = withDefaults(
  defineProps<{
    open: boolean
    clientId: number | null
    wallet?: number
    dues?: PaymentDue[]
    preset?: PaymentPreset | null
    mode?: 'receive' | 'apply'
  }>(),
  { wallet: 0, dues: () => [], preset: null, mode: 'receive' },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
}>()

const { t } = useI18n()
const error = ref('')
const saving = ref(false)
const amount = ref('')
const method = ref('cash')
const notes = ref('')
const applyKey = ref('credit')

const wallet = computed(() => Number(props.wallet || 0))
const isApply = computed(() => props.mode === 'apply')
const dueOptions = computed(() => (props.dues || []).filter((d) => d.remaining > 0))
const selectedDue = computed(() => {
  if (applyKey.value === 'credit') return null
  return dueOptions.value.find((d) => `${d.type}:${d.id}` === applyKey.value) ?? null
})
const remaining = computed(() => selectedDue.value?.remaining ?? 0)
const amountNum = computed(() => Math.max(0, Number(amount.value) || 0))
const usingWallet = computed(() => isApply.value || method.value === 'wallet')
const canUseWallet = computed(() => wallet.value > 0 && !!selectedDue.value)
const leftover = computed(() => {
  if (usingWallet.value || !selectedDue.value) return 0
  return Math.max(0, amountNum.value - remaining.value)
})

watch(
  () => [props.open, props.mode, props.preset] as const,
  ([open]) => {
    if (!open) return
    error.value = ''
    notes.value = ''
    const preset = props.preset
    if (preset && preset.type !== 'credit') {
      applyKey.value = `${preset.type}:${preset.id}`
    } else {
      applyKey.value = isApply.value && dueOptions.value[0]
        ? `${dueOptions.value[0].type}:${dueOptions.value[0].id}`
        : 'credit'
    }
    method.value = isApply.value ? 'wallet' : 'cash'
    syncAmount()
  },
)

watch([applyKey, method], () => {
  if (!props.open) return
  if (applyKey.value === 'credit' && method.value === 'wallet') {
    method.value = 'cash'
  }
  syncAmount()
})

function syncAmount() {
  const due = selectedDue.value
  if (usingWallet.value) {
    amount.value = due ? String(Math.min(wallet.value, due.remaining)) : String(wallet.value)
    return
  }
  amount.value = due ? String(due.remaining) : ''
}

function dueKey(due: PaymentDue) {
  return `${due.type}:${due.id}`
}

async function submit() {
  if (!props.clientId || saving.value) return
  error.value = ''
  saving.value = true
  try {
    const due = selectedDue.value
    if (usingWallet.value) {
      if (!due) {
        error.value = t('clients.needDue')
        return
      }
      await api.post('/api/payments', {
        client_id: props.clientId,
        amount: amountNum.value,
        method: 'wallet',
        invoice_id: due.type === 'invoice' ? due.id : null,
        installment_id: due.type === 'installment' ? due.id : null,
        apply_to: due.type,
      })
    } else {
      await api.post('/api/payments', {
        client_id: props.clientId,
        amount: amountNum.value,
        method: method.value,
        notes: notes.value || null,
        apply_to: due ? due.type : 'credit',
        invoice_id: due?.type === 'invoice' ? due.id : null,
        installment_id: due?.type === 'installment' ? due.id : null,
      })
    }
    emit('update:open', false)
    emit('saved')
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormDialog
    :open="open"
    :title="isApply ? t('clients.applyCreditTitle') : t('clients.receiveTitle')"
    :description="t('clients.receiveDesc', { n: wallet })"
    :submit-label="t('tech.recordPay')"
    :error="error"
    :loading="saving"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <Field :label="t('clients.applyTo')">
      <select v-model="applyKey" class="select">
        <option v-if="!isApply" value="credit">{{ t('clients.saveAsCredit') }}</option>
        <option v-for="due in dueOptions" :key="dueKey(due)" :value="dueKey(due)">
          {{ due.label }} · {{ t('contracts.remaining') }} {{ due.remaining }}
        </option>
      </select>
    </Field>
    <Field :label="t('tech.amount')">
      <Input v-model="amount" type="number" min="1" step="1" required />
    </Field>
    <Field v-if="!isApply" :label="t('tech.method')">
      <select v-model="method" class="select">
        <option value="cash">{{ t('tech.cash') }}</option>
        <option value="card">{{ t('tech.card') }}</option>
        <option value="bank">{{ t('tech.bank') }}</option>
        <option v-if="canUseWallet" value="wallet">{{ t('tech.wallet', { n: wallet }) }}</option>
      </select>
    </Field>
    <Field v-if="!usingWallet" :label="t('common.notes')">
      <Input v-model="notes" :placeholder="t('common.optional')" />
    </Field>
    <p v-if="usingWallet && selectedDue" class="text-xs text-slate-500">{{ t('clients.walletMethodHint', { n: Math.min(wallet, remaining) }) }}</p>
    <p v-if="leftover > 0" class="text-xs text-slate-500">{{ t('clients.leftoverHint', { n: leftover }) }}</p>
  </FormDialog>
</template>
