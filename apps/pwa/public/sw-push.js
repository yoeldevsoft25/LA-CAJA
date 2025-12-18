// Service Worker para manejar push notifications
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {}
    
  const options = {
    body: data.body || 'Nueva notificación',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'notification',
    data: data.data || {},
    requireInteraction: data.requireInteraction || false,
    actions: data.action_url ? [
      {
        action: 'open',
        title: data.action_label || 'Abrir',
      },
      {
        action: 'close',
        title: 'Cerrar',
      }
    ] : [],
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Notificación', options)
  )
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  
  if (event.action === 'open' || !event.action) {
    const urlToOpen = event.notification.data.url || '/'
    event.waitUntil(
      clients.openWindow(urlToOpen)
    )
  }
})

