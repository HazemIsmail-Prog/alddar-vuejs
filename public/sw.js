self.addEventListener('push', (event) => {
  let data = { title: 'Engineering Home', body: '', url: '/tech' }
  try {
    data = { ...data, ...event.data.json() }
  } catch {
    try {
      const text = event.data?.text()
      if (text) data.body = text
    } catch {
      // Default title/body above.
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Engineering Home', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/tech' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = event.notification.data?.url || '/tech'

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      const url = new URL(client.url)
      if (url.origin === self.location.origin && 'focus' in client) {
        await client.focus()
        if ('navigate' in client) {
          await client.navigate(path)
        }
        return
      }
    }
    await self.clients.openWindow(path)
  })())
})
