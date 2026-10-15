'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-fetch';

export function StaffOrderUpdates({user, outletId}: {user: any; outletId: string}) {
  const [connection, setConnection] = useState('Connecting to orders...');
  const [toast, setToast] = useState('');
  const [pushState, setPushState] = useState('Checking notification support...');
  const [configured, setConfigured] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState('');
  const allowed = ['OWNER', 'MANAGER', 'CASHIER', 'KITCHEN_STAFF'].includes(user?.role);

  useEffect(() => {
    if (!allowed || !outletId) return;
    let stopped = false, timer: ReturnType<typeof setTimeout>, revision = '', failures = 0, inFlight = false, lastRefreshAt = Date.now();
    const controller = new AbortController();
    const emit = () => window.dispatchEvent(new CustomEvent('staff-order-update', {detail: {outletId}}));
    const poll = async () => {
      if (inFlight || stopped) return;
      inFlight = true;
      clearTimeout(timer);
      try {
        const res = await apiFetch(outletId, '/api/live/orders', {cache: 'no-store', signal: controller.signal});
        if (stopped) return;
        if ([401, 403, 402].includes(res.status)) { setConnection('Order updates paused. Check your sign-in and access.'); return; }
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!data.success || !data.revision) throw new Error();
        if (stopped) return;
        if (revision && data.revision !== revision) { emit(); setToast('Order activity updated'); }
        // Also catch up after a temporary outage without replaying old notifications.
        if (failures || Date.now() - lastRefreshAt >= 30000) { emit(); lastRefreshAt = Date.now(); }
        revision = data.revision; failures = 0;
        setConnection('Orders auto-update');
      } catch { if (!stopped) { failures++; setConnection('Reconnecting. Order screens may be out of date.'); } }
      inFlight = false;
      if (!stopped) timer = setTimeout(poll, Math.min(60000, failures ? 4000 * 2 ** Math.min(failures, 4) : document.hidden ? 30000 : 4000));
    };
    // Serial polling, one timer, no overlapping requests. Focus re-checks at next tick.
    const wake = () => { if (!document.hidden) { clearTimeout(timer); timer = setTimeout(poll, 250); } };
    const onPush = (event: MessageEvent) => { if (event.data?.type === 'staff-order-update') emit(); };
    poll();
    document.addEventListener('visibilitychange', wake); window.addEventListener('online', wake);
    navigator.serviceWorker?.addEventListener('message', onPush);
    return () => { stopped = true; controller.abort(); clearTimeout(timer); document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake); navigator.serviceWorker?.removeEventListener('message', onPush); };
  }, [allowed, outletId, user?.id]);

  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 5000); return () => clearTimeout(timer); }, [toast]);

  useEffect(() => {
    if (!allowed || !outletId) return;
    let stopped = false;
    setConfigured(false); setEnabled(false);
    if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setPushState('Background alerts are not supported here. On iPhone, try the app added to Home Screen.'); return;
    }
    (async () => {
      try {
        const res = await apiFetch(outletId, '/api/push/config'); const config = await res.json();
        if (stopped) return;
        if (!res.ok || !config.configured) { setPushState('Background alerts: setup pending. In-app updates still work.'); return; }
        setConfigured(true); setKey(config.publicKey);
        const registration = await navigator.serviceWorker.register('/staff-push-sw.js');
        const subscription = await registration.pushManager.getSubscription();
        if (stopped) return;
        if (subscription && Notification.permission === 'granted') {
          const saved = await apiFetch(outletId, '/api/push/subscription', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(subscription)});
          if (!saved.ok) throw new Error();
          if (!stopped) {setEnabled(true); setPushState('Background alerts on for this outlet and sign-in.');}
        } else setPushState(Notification.permission === 'denied' ? 'Alerts blocked. Change this site permission in browser settings.' : 'Allow alerts on this device, even when the site is closed.');
      } catch { if (!stopped) setPushState('Could not set up background alerts. Try again.'); }
    })();
    return () => { stopped = true; };
  }, [allowed, outletId, user?.id]);

  const toggle = async () => {
    setBusy(true);
    try {
      if (enabled) {
        const res = await apiFetch(outletId, '/api/push/subscription', {method: 'DELETE'});
        if (!res.ok) throw new Error('Could not turn alerts off. Retry before signing out.');
        const registration = await navigator.serviceWorker.getRegistration('/');
        await (await registration?.pushManager.getSubscription())?.unsubscribe();
        setEnabled(false); setPushState('Background alerts off on this device.'); return;
      }
      // Permission request comes directly from a user gesture, never on load.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setPushState('Alerts not allowed. You can change this in browser settings.'); return; }
      const registration = await navigator.serviceWorker.register('/staff-push-sw.js');
      await navigator.serviceWorker.ready;
      const bytes = Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
      const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: bytes});
      const res = await apiFetch(outletId, '/api/push/subscription', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(subscription)});
      if (!res.ok) { await subscription.unsubscribe(); throw new Error('Could not enable alerts. Try again.'); }
      setEnabled(true); setPushState('Background alerts on for this outlet and sign-in.');
    } catch (error: any) { setPushState(error.message || 'Could not enable alerts. Try again.'); }
    finally { setBusy(false); }
  };

  if (!allowed || !outletId) return null;
  return <section aria-label="Order updates" className="border-b border-emerald-100 bg-emerald-50 px-3 sm:px-6 py-2 text-xs text-emerald-950">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span role="status" className="font-bold">{connection}</span>
      <span className="min-w-0 flex-1 basis-40">{pushState}</span>
      {configured && <button disabled={busy} onClick={toggle} className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 font-bold disabled:opacity-50">{busy ? 'Please wait...' : enabled ? 'Turn alerts off' : 'Enable alerts'}</button>}
    </div>
    {toast && <div role="status" className="fixed bottom-4 left-4 right-4 sm:left-auto sm:w-80 z-50 rounded-xl bg-slate-900 px-4 py-3 text-white shadow-lg flex items-center justify-between gap-3">{toast}<button aria-label="Dismiss order update" onClick={() => setToast('')}>Close</button></div>}
  </section>;
}
