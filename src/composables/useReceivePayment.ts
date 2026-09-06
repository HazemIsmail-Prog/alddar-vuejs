import { ref } from 'vue'
import type { PaymentPreset } from '@/components/ReceivePaymentDialog.vue'

export function useReceivePayment() {
  const payOpen = ref(false)
  const payMode = ref<'receive' | 'apply'>('receive')
  const payPreset = ref<PaymentPreset | null>(null)

  function openReceive(preset: PaymentPreset | null = { type: 'credit' }) {
    payMode.value = 'receive'
    payPreset.value = preset
    payOpen.value = true
  }

  function openApply(preset: PaymentPreset | null = null) {
    payMode.value = 'apply'
    payPreset.value = preset
    payOpen.value = true
  }

  function startCollect(kind: 'invoice' | 'installment', id: number) {
    openReceive({ type: kind, id })
  }

  return { payOpen, payMode, payPreset, openReceive, openApply, startCollect }
}
