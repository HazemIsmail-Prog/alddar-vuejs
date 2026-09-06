import api from '@/api/client'

const SW_PATH = '/sw.js'

function vapidToBytes(key: string) {
  const padded = key.replace(/-/g, '+').replace(/_/g, '/')
  const base64 = padded + '='.repeat((4 - (padded.length % 4)) % 4)
  const raw = atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export function isIosDevice() {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isStandaloneDisplay() {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

export function needsIosInstallHint() {
  return isIosDevice() && !isStandaloneDisplay()
}

export function pushSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
}

export function canOfferPush() {
  if (!pushSupported() || needsIosInstallHint()) return false
  return Notification.permission !== 'granted'
}

async function registration() {
  if (!pushSupported()) return null
  return navigator.serviceWorker.register(SW_PATH)
}

export async function enableTechPush() {
  if (!pushSupported() || needsIosInstallHint()) return
  const { data } = await api.get('/api/push/vapid')
  const publicKey = String(data.public_key || '')
  if (!publicKey) return

  const reg = await registration()
  if (!reg) return

  let permission = Notification.permission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }
  if (permission !== 'granted') return

  const existing = await reg.pushManager.getSubscription()
  const sub = existing ?? await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidToBytes(publicKey),
  })
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return

  await api.post('/api/push/subscribe', {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    contentEncoding: 'aes128gcm',
  })
}

export async function disableTechPush() {
  try {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.getRegistration(SW_PATH)
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return
    try {
      await api.delete('/api/push/subscribe', { data: { endpoint: sub.endpoint } })
    } catch {
      // Session may already be gone; still drop the local subscription.
    }
    await sub.unsubscribe()
  } catch {
    // Ignore unsubscribe failures on logout.
  }
}
