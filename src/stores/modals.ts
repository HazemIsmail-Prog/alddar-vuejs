import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api/client'
import type { ClientRecord } from '@/components/ClientPicker.vue'

export type ModalKind = 'client' | 'contract' | 'order' | 'client-deleted'

export const useModalsStore = defineStore('modals', () => {
  let seq = 0
  function nextToken() {
    return ++seq
  }

  const clientForm = ref({ token: 0, open: false, id: null as number | null })
  const contractForm = ref({
    token: 0,
    open: false,
    editId: null as number | null,
    client: null as ClientRecord | null,
  })
  const orderForm = ref({
    token: 0,
    open: false,
    client: null as ClientRecord | null,
  })

  const savedAt = ref(0)
  const savedKind = ref<ModalKind | null>(null)
  const savedId = ref<number | null>(null)

  function notifySaved(kind: ModalKind, id?: number | null) {
    savedKind.value = kind
    savedId.value = id ?? null
    savedAt.value += 1
  }

  function createClient() {
    clientForm.value = { token: nextToken(), open: true, id: null }
  }

  function editClient(id: number) {
    clientForm.value = { token: nextToken(), open: true, id }
  }

  function closeClient() {
    clientForm.value = { ...clientForm.value, open: false }
  }

  function createContract(client?: ClientRecord | null) {
    contractForm.value = { token: nextToken(), open: true, editId: null, client: client ?? null }
  }

  function editContract(id: number) {
    contractForm.value = { token: nextToken(), open: true, editId: id, client: null }
  }

  function closeContract() {
    contractForm.value = { ...contractForm.value, open: false }
  }

  function createOrder(client?: ClientRecord | null) {
    orderForm.value = { token: nextToken(), open: true, client: client ?? null }
  }

  function closeOrder() {
    orderForm.value = { ...orderForm.value, open: false }
  }

  async function fetchClient(id: number): Promise<ClientRecord> {
    return (await api.get(`/api/clients/${id}`)).data
  }

  async function createOrderForClient(clientId: number) {
    createOrder(await fetchClient(clientId))
  }

  async function createContractForClient(clientId: number) {
    createContract(await fetchClient(clientId))
  }

  async function runSearchAction(action: { modal?: string; client_id?: number }) {
    if (action.modal === 'create-order' && action.client_id) {
      await createOrderForClient(action.client_id)
      return true
    }
    if (action.modal === 'create-contract' && action.client_id) {
      await createContractForClient(action.client_id)
      return true
    }
    if (action.modal === 'edit-client' && action.client_id) {
      editClient(action.client_id)
      return true
    }
    return false
  }

  return {
    clientForm,
    contractForm,
    orderForm,
    savedAt,
    savedKind,
    savedId,
    notifySaved,
    createClient,
    editClient,
    closeClient,
    createContract,
    editContract,
    closeContract,
    createOrder,
    closeOrder,
    createOrderForClient,
    createContractForClient,
    runSearchAction,
  }
})
