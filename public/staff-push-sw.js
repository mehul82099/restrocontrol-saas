// No fetch handler: never cache authenticated API responses or dashboard pages.
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    try {
      const {subscriptionId} = event.data.json();
      const response = await fetch('/api/push/current?id=' + encodeURIComponent(subscriptionId), {credentials: 'include', cache: 'no-store'});
      if (!response.ok) return; // Signed out, expired, disabled or no longer assigned.
      const data = await response.json();
      if (!data.success) return;
      await self.registration.showNotification('RestroControl', {body: data.message === 'Ready-to-serve tickets updated. Open your staff screen.' ? data.message : 'Order activity updated. Open your staff screen.', tag: 'staff-order-update', data: {url: data.url}});
      for (const client of await self.clients.matchAll({type: 'window'})) client.postMessage({type: 'staff-order-update'});
    } catch { /* Offline or unverifiable session: do not show private activity. */ }
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL(event.notification.data?.url || '/orders', self.location.origin);
    const path = target.origin === self.location.origin && ['/kot', '/orders', '/waiter'].includes(target.pathname) ? target.pathname + target.search : '/orders';
    const windows = await self.clients.matchAll({type: 'window'});
    const client = windows.find(w => new URL(w.url).origin === self.location.origin);
    if (client) { await client.navigate(path); await client.focus(); }
    else await self.clients.openWindow(path);
  })());
});
