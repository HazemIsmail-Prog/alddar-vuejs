import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api from '@/api/client'
import { statusName } from '@/i18n'

export type OrderStatusRecord = {
  id: number
  name_en: string
  name_ar: string
  slug: string
  color: string
  sort_order: number
  is_system: boolean
}

export const useStatusStore = defineStore('statuses', () => {
  const items = ref<OrderStatusRecord[]>([])
  const loaded = ref(false)

  const bySlug = computed(() => Object.fromEntries(items.value.map((row) => [row.slug, row])))

  function meta(slug?: string | null) {
    if (!slug) return null
    return bySlug.value[slug] ?? null
  }

  function label(slug?: string | null) {
    return statusName(meta(slug), slug || undefined)
  }

  async function load() {
    items.value = (await api.get('/api/order-statuses')).data
    loaded.value = true
  }

  return { items, loaded, bySlug, meta, label, load }
})
