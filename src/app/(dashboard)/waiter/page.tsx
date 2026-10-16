'use client';
import { useEffect, useRef, useState } from 'react';
import { useOutlet } from '../layout';
import { apiFetch } from '@/lib/api-fetch';
import { useOrderUpdates } from '@/lib/use-order-updates';
import { ticketToken } from '@/lib/pos-recovery';

export default function WaiterPage() {
  const {user, activeOutletId} = useOutlet();
  const currentScope = `${user?.id}:${activeOutletId}`;
  const scope = useRef(currentScope); scope.current = currentScope;
  const [items, setItems] = useState<any[]>([]), [tables, setTables] = useState<any[]>([]), [tickets, setTickets] = useState<any[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [tableId, setTableId] = useState(''), [type, setType] = useState('DINE_IN');
  const [search, setSearch] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false), [pending, setPending] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    const requested = currentScope;
    try {
      const response = await apiFetch(activeOutletId, '/api/waiter/orders', {cache: 'no-store'}); const data = await response.json();
      if (scope.current !== requested) return;
      if (!response.ok || !data.success) throw new Error('Ready tickets unavailable.');
      setTickets(data.tickets); setError('');
    } catch (e: any) { if (scope.current === requested) setError(e.message); }
  };
  useOrderUpdates(activeOutletId, refresh);
  useEffect(() => {
    let disposed = false;
    setItems([]); setTables([]); setTickets([]); setCart({}); setPending(null); setTableId(''); setMessage(''); setError(''); setLoading(true); setBusy(false);
    if (!user || !activeOutletId) return;
    (async () => {
      try {
        const response = await apiFetch(activeOutletId, '/api/waiter/catalog'); const data = await response.json();
        if (disposed) return;
        if (!response.ok || !data.success) throw new Error('Order entry unavailable for this account/outlet.');
        setItems(data.items); setTables(data.tables); await refresh();
      } catch (e: any) { if (!disposed) setError(e.message); }
      finally { if (!disposed) setLoading(false); }
    })();
    return () => {disposed = true;};
  }, [currentScope]);
  const total = items.reduce((n, item) => n + Math.round(item.basePrice * 100) / 100 * (cart[item.id] || 0) * (1 + item.taxRate / 100), 0);
  const count = Object.values(cart).reduce((n, q) => n + q, 0);
  const submit = async () => {
    if (busy || !user) return;
    const requested = currentScope;
    const payload = pending || {idempotencyKey: `WAITER-${user.id}-${crypto.randomUUID()}`, orderType: type, tableId: type === 'DINE_IN' ? tableId : null, items: Object.entries(cart).filter(([,q]) => q > 0).map(([menuItemId,quantity]) => ({menuItemId,quantity}))};
    // Preserve the exact retry after a network error; never make a new duplicate order.
    setPending(payload); setBusy(true); setError('');
    try {
      const response = await apiFetch(activeOutletId, '/api/waiter/orders', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)});
      const data = await response.json();
      if (scope.current !== requested) return;
      if (!response.ok || !data.success) {
        if (response.status >= 400 && response.status < 500) setPending(null);
        throw new Error(data.error || 'Order not confirmed. Retry the same order.');
      }
      setMessage(`Sent to kitchen: ${ticketToken(data.orderNumber)}. Payment remains with the cashier.`); setCart({}); setPending(null); await refresh();
    } catch (e: any) { if (scope.current === requested) setError(e.message || 'Order not confirmed. Retry the same order.'); }
    finally { if (scope.current === requested) setBusy(false); }
  };
  return <div className="max-w-6xl mx-auto space-y-5">
    <div><h1 className="text-2xl font-black text-slate-900">Waiter Orders</h1><p className="text-sm text-slate-500 mt-1">Take orders and collect ready dishes. Payments stay with the cashier.</p></div>
    {error && <p role="alert" className="bg-amber-50 text-amber-900 p-4 rounded-xl">{error}</p>}
    {message && <p role="status" className="bg-emerald-50 text-emerald-900 p-4 rounded-xl">{message}</p>}
    {loading ? <p>Loading your outlet...</p> : <div className="grid lg:grid-cols-2 gap-5 items-start">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
        <h2 className="font-bold text-lg">New order</h2>
        <fieldset disabled={busy || !!pending} className="space-y-4 disabled:opacity-60">
          <div className="flex flex-wrap gap-3"><label className="text-sm">Order type<select aria-label="Order type" value={type} onChange={e => setType(e.target.value)} className="block border rounded-lg p-2 mt-1"><option value="DINE_IN">Dine in</option><option value="TAKEAWAY">Takeaway</option></select></label>
          {type === 'DINE_IN' && <label className="text-sm flex-1 min-w-32">Table<select aria-label="Table" value={tableId} onChange={e => setTableId(e.target.value)} className="block border rounded-lg p-2 mt-1 w-full"><option value="">Choose a table</option>{tables.map(table => <option key={table.id} value={table.id}>{table.tableNumber} ({table.status.toLowerCase()})</option>)}</select></label>}</div>
          <input aria-label="Search menu" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu" className="border rounded-lg p-2 w-full" />
          <p className="text-xs text-slate-500">Standard menu items only. Ask the cashier for variants, add-ons or special billing.</p>
          <div className="max-h-80 overflow-y-auto divide-y">{items.filter(item => item.name.toLowerCase().includes(search.toLowerCase())).map(item => <div key={item.id} className="py-3 flex items-center justify-between gap-3"><div className="min-w-0"><p className="font-semibold break-words">{item.name}</p><p className="text-xs text-slate-500">₹{item.basePrice.toFixed(2)} + {item.taxRate}% tax</p></div><label className="text-xs flex-shrink-0">Qty<input type="number" aria-label={`${item.name} quantity`} min="0" max="100" value={cart[item.id] || 0} onChange={e => setCart({...cart, [item.id]: Math.max(0, Math.min(100, parseInt(e.target.value) || 0))})} className="block w-16 border rounded-lg p-2 mt-1 text-sm" /></label></div>)}</div>
        </fieldset>
        <div className="flex flex-wrap justify-between gap-3 font-bold"><span>{count} items</span><span>Approx. ₹{total.toFixed(2)} incl. tax</span></div>
        <button onClick={submit} disabled={busy || (!pending && (!count || (type === 'DINE_IN' && !tableId)))} className="w-full bg-emerald-600 text-white rounded-xl py-3 font-bold disabled:opacity-50">{busy ? 'Sending...' : pending ? 'Retry same order' : 'Send to kitchen (unpaid)'}</button>
        {pending && <p className="text-xs text-amber-800">Keep this screen open. The same order reference is used when you retry, so it will not be placed twice.</p>}
      </section>
      <section className="space-y-3"><div className="flex justify-between items-center gap-3"><h2 className="font-bold text-lg">Ready to serve</h2><button onClick={refresh} className="text-sm underline">Check now</button></div>
        <p className="text-xs text-slate-500">Updates automatically for this outlet. Kitchen staff mark tickets served.</p>
        {!tickets.length && <div className="bg-white border rounded-xl p-5 text-sm text-slate-500">No ready tickets right now.</div>}
        {tickets.map(ticket => <article key={ticket.id} className="bg-white border border-emerald-200 rounded-2xl p-4 space-y-3"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-black">#{ticketToken(ticket.kotNumber)}</h3><span className="text-xs bg-emerald-50 text-emerald-900 px-2 py-1 rounded-full">READY TO SERVE</span></div><p className="font-semibold">{ticket.order.table ? `Table ${ticket.order.table.tableNumber}` : ticket.order.orderType.toLowerCase()}</p><ul className="space-y-2">{ticket.items.map((item: any,i: number) => <li key={i}>{item.quantity} × {item.orderItem.name}{item.orderItem.notes && <p className="text-xs text-slate-500">{item.orderItem.notes}</p>}</li>)}</ul></article>)}
      </section>
    </div>}
  </div>;
}
