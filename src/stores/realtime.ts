import { defineStore } from 'pinia'
import { connectEcho, disconnectEcho, type StaffEvent } from '@/lib/echo'
import { useAuthStore } from '@/stores/auth'
import { useInboxStore } from '@/stores/inbox'

export const useRealtimeStore = defineStore('realtime', () => {
  const listeners = new Set<(event: StaffEvent) => void>()
  let connected = false

  function emit(event: StaffEvent) {
    const auth = useAuthStore()
    if (auth.isFieldTech()) {
      if (event.kind === 'client') return
      if (event.kind === 'conversation' && event.type && event.type !== 'order') return
    }
    listeners.forEach((fn) => fn(event))
    if (event.kind === 'order' && auth.isFieldTech()) {
      void useInboxStore().load()
    }
    if (event.kind === 'conversation') {
      if (event.action === 'read') return
      if (auth.isFieldTech() && event.type && event.type !== 'order') return
      const inbox = useInboxStore()
      if (inbox.isViewing(event.type, event.id)) {
        void inbox.markRead(event.type, event.id)
      } else {
        void inbox.load()
      }
    }
  }

  function listen(handler: (event: StaffEvent) => void) {
    listeners.add(handler)
    return () => listeners.delete(handler)
  }

  function connect() {
    if (connected) return
    connectEcho(emit, () => {
      void useInboxStore().load()
    })
    connected = true
  }

  function disconnect() {
    disconnectEcho()
    connected = false
  }

  return { listen, connect, disconnect }
})
