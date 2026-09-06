import { onMounted, onUnmounted } from 'vue'
import { useRealtimeStore } from '@/stores/realtime'
import type { StaffEvent } from '@/lib/echo'

export function useStaffEvent(handler: (event: StaffEvent) => void) {
  const realtime = useRealtimeStore()
  let stop: (() => void) | undefined

  onMounted(() => {
    stop = realtime.listen(handler)
  })

  onUnmounted(() => stop?.())
}

function coalesce(prev: StaffEvent | undefined, next: StaffEvent): StaffEvent {
  if (!prev) return next
  if (
    prev.kind === 'conversation'
    && next.kind === 'conversation'
    && next.action === 'read'
    && prev.action !== 'read'
  ) {
    return prev
  }
  return next
}

export function useStaffReload(match: (event: StaffEvent) => boolean, reload: (event: StaffEvent) => unknown, wait = 200) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: StaffEvent | undefined

  onUnmounted(() => {
    if (timer) clearTimeout(timer)
  })

  useStaffEvent((event) => {
    if (!match(event)) return
    pending = coalesce(pending, event)
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      const next = pending
      pending = undefined
      if (next) void reload(next)
    }, wait)
  })
}
