import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import type { ChannelAuthorizationCallback } from 'pusher-js'
import api from '@/api/client'

export type OrderChangedPayload = {
  kind: 'order'
  action: string
  order_id: number
  department_id: number | null
  technician_id: number | null
  client_id: number | null
  status: string
}

export type ClientChangedPayload = {
  kind: 'client'
  action: string
  client_id: number
}

export type ConversationChangedPayload = {
  kind: 'conversation'
  action: 'comment' | 'attachment' | 'read' | string
  type: string
  id: number
}

export type StaffEvent = OrderChangedPayload | ClientChangedPayload | ConversationChangedPayload

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function orderEvent(payload: Record<string, unknown>): OrderChangedPayload {
  return {
    kind: 'order',
    action: String(payload.action ?? ''),
    order_id: num(payload.order_id ?? payload.orderId) ?? 0,
    department_id: num(payload.department_id ?? payload.departmentId),
    technician_id: num(payload.technician_id ?? payload.technicianId),
    client_id: num(payload.client_id ?? payload.clientId),
    status: String(payload.status ?? ''),
  }
}

function conversationEvent(payload: Record<string, unknown>): ConversationChangedPayload {
  return {
    kind: 'conversation',
    action: String(payload.action ?? ''),
    type: String(payload.type ?? ''),
    id: num(payload.id) ?? 0,
  }
}

let echo: Echo<'pusher'> | null = null

export function connectEcho(onEvent: (event: StaffEvent) => void, onReady?: () => void): void {
  const key = import.meta.env.VITE_PUSHER_APP_KEY
  if (!key || echo) return

  echo = new Echo({
    broadcaster: 'pusher',
    key,
    cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER || 'mt1',
    forceTLS: true,
    Pusher,
    authorizer: (channel: { name: string }) => ({
      authorize: (socketId: string, callback: ChannelAuthorizationCallback) => {
        api.post('/broadcasting/auth', {
          socket_id: socketId,
          channel_name: channel.name,
        })
          .then((response) => callback(null, response.data))
          .catch((error) => callback(error as Error, null))
      },
    }),
  })

  echo.private('staff')
    .listen('.order.changed', (payload: Record<string, unknown>) => {
      onEvent(orderEvent(payload))
    })
    .listen('.client.changed', (payload: Omit<ClientChangedPayload, 'kind'>) => {
      onEvent({ kind: 'client', ...payload })
    })
    .listen('.conversation.changed', (payload: Record<string, unknown>) => {
      onEvent(conversationEvent(payload))
    })
    .subscribed(() => onReady?.())
}

export function disconnectEcho(): void {
  echo?.disconnect()
  echo = null
}
