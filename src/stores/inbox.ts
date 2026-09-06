import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api from '@/api/client'

export type InboxThread = {
  type: string
  id: number
  title: string
  unread: number
  preview: string
  at: string
  href: string
  department_id?: number | null
}

function sameThread(thread: { type: string; id: number }, type: string, id: number) {
  return thread.type === type && Number(thread.id) === Number(id)
}

function navKeyFor(thread: InboxThread) {
  const path = (thread.href || '').split('?')[0].split('#')[0]
  if (!path) return ''
  if (path === '/dispatch' || path === '/tech') return path
  const segment = path.split('/').filter(Boolean)[0]
  return segment ? `/${segment}` : path
}

function navFromThreads(rows: InboxThread[]) {
  const nav: Record<string, number> = {}
  for (const thread of rows) {
    if (!thread.unread) continue
    const key = navKeyFor(thread)
    if (!key) continue
    nav[key] = (nav[key] || 0) + thread.unread
  }
  return nav
}

export const useInboxStore = defineStore('inbox', () => {
  const threadsRaw = ref<InboxThread[]>([])
  const loading = ref(false)
  const viewing = ref<{ type: string; id: number } | null>(null)
  const allowedOrderIds = ref<number[] | null>(null)

  function isAllowedThread(thread: InboxThread) {
    const ids = allowedOrderIds.value
    if (ids === null) return true
    if (thread.type !== 'order') return false
    return ids.includes(Number(thread.id))
  }

  const visibleRaw = computed(() => threadsRaw.value.filter(isAllowedThread))

  const threads = computed(() => {
    const open = viewing.value
    const rows = visibleRaw.value
    if (!open) return rows
    return rows.map((thread) =>
      sameThread(thread, open.type, open.id) ? { ...thread, unread: 0 } : thread,
    )
  })

  const unreadTotal = computed(() =>
    threads.value.reduce((sum, thread) => sum + thread.unread, 0),
  )

  const nav = computed(() => navFromThreads(threads.value))

  const orderUnread = computed(() =>
    threads.value.filter((thread) => thread.type === 'order').reduce((sum, thread) => {
      sum[Number(thread.id)] = thread.unread
      return sum
    }, {} as Record<number, number>),
  )

  const unreadByDepartment = computed(() =>
    threads.value.filter((thread) => thread.type === 'order').reduce((sum, thread) => {
      const departmentId = Number(thread.department_id)
      if (!departmentId) return sum
      sum[departmentId] = (sum[departmentId] || 0) + thread.unread
      return sum
    }, {} as Record<number, number>),
  )

  const clientUnread = computed(() =>
    threads.value.filter((thread) => thread.type === 'client').reduce((sum, thread) => {
      sum[thread.id] = thread.unread
      return sum
    }, {} as Record<number, number>),
  )

  const contractUnread = computed(() =>
    threads.value.filter((thread) => thread.type === 'contract').reduce((sum, thread) => {
      sum[thread.id] = thread.unread
      return sum
    }, {} as Record<number, number>),
  )

  let inflight: Promise<void> | null = null
  let pending = false

  async function load() {
    if (inflight) {
      pending = true
      return inflight
    }
    loading.value = true
    inflight = (async () => {
      try {
        const { data } = await api.get('/api/inbox')
        threadsRaw.value = data.threads || []
      } catch {
        // keep last snapshot
      } finally {
        loading.value = false
        inflight = null
        if (pending) {
          pending = false
          await load()
        }
      }
    })()
    return inflight
  }

  async function markRead(type: string, id: number) {
    await api.post(`/api/inbox/${type}/${id}/read`)
    await load()
  }

  function watchThread(type: string, id: number) {
    if (!type || !id) return
    viewing.value = { type, id: Number(id) }
  }

  function unwatchThread(type: string, id: number) {
    if (viewing.value && sameThread(viewing.value, type, id)) {
      viewing.value = null
    }
  }

  function isViewing(type: string, id: number) {
    return !!viewing.value && sameThread(viewing.value, type, id)
  }

  function limitOrderThreads(ids: number[] | null) {
    allowedOrderIds.value = ids === null
      ? null
      : [...new Set(ids.map(Number).filter((id) => id > 0))]
  }

  function countFor(path: string) {
    return nav.value[path] || 0
  }

  function orderUnreadForDepartment(departmentId: number | string | null | undefined) {
    return unreadByDepartment.value[Number(departmentId)] || 0
  }

  function orderUnreadFor(orderId: number | string | null | undefined) {
    return orderUnread.value[Number(orderId)] || 0
  }

  return {
    unreadTotal,
    threads,
    nav,
    loading,
    orderUnread,
    unreadByDepartment,
    clientUnread,
    contractUnread,
    load,
    markRead,
    watchThread,
    unwatchThread,
    isViewing,
    limitOrderThreads,
    countFor,
    orderUnreadForDepartment,
    orderUnreadFor,
  }
})
