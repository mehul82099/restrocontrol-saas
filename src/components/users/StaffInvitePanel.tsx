'use client';

import React, { useEffect, useState } from 'react';
import { Link2, Copy, XCircle } from 'lucide-react';

interface Invite { id: string; role: string; label?: string | null; expiresAt: string; state: 'PENDING' | 'USED' | 'EXPIRED' | 'REVOKED'; usedBy?: { name: string } | null }
const ROLE_LABEL: Record<string, string> = { CASHIER: 'Cashier', KITCHEN_STAFF: 'Kitchen', WAITER: 'Waiter' };
const STATE_STYLE: Record<string, string> = { PENDING: 'text-emerald-700 bg-emerald-50', USED: 'text-slate-600 bg-slate-100', EXPIRED: 'text-amber-700 bg-amber-50', REVOKED: 'text-rose-700 bg-rose-50' };

export default function StaffInvitePanel({ onJoined }: { onJoined?: () => void }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [role, setRole] = useState('CASHIER');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const r = await fetch('/api/staff-invites').then((x) => x.json()).catch(() => null);
    if (r?.success) { setInvites(r.invites); onJoined?.(); }
  };
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(''); setLink(''); setCopied(false);
    try {
      const res = await fetch('/api/staff-invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, label }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || 'Could not create the link.');
      setLink(d.link); setLabel(''); await load();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };
  const revoke = async (id: string) => {
    await fetch(`/api/staff-invites/${id}`, { method: 'DELETE' });
    await load();
  };
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { /* user can select the text */ } };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4" data-testid="invite-panel">
      <div>
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2"><Link2 className="w-4 h-4 text-emerald-600" />Invite staff by link</h2>
        <p className="text-xs text-slate-500 mt-1">One link per person. It works once and expires in 48 hours. They can join with Google or email.</p>
      </div>
      <form onSubmit={create} className="flex flex-col sm:flex-row gap-2">
        <select value={role} onChange={(e) => setRole(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white">
          <option value="CASHIER">Cashier</option><option value="KITCHEN_STAFF">Kitchen</option><option value="WAITER">Waiter</option>
        </select>
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="Who is this for? (optional)" className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm" />
        <button disabled={busy} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl disabled:opacity-50">Create link</button>
      </form>
      {error && <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2">{error}</div>}
      {link && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
          <p className="text-xs text-emerald-800 font-medium">Copy this link now. For safety it is shown only once.</p>
          <div className="flex gap-2 items-center"><input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-emerald-200 rounded-lg bg-white" /><button type="button" onClick={copy} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-white border border-emerald-300 rounded-lg"><Copy className="w-3 h-3" />{copied ? 'Copied' : 'Copy'}</button></div>
        </div>
      )}
      {invites.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {invites.slice(0, 8).map((i) => (
            <li key={i.id} className="py-2 flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <span className="font-medium text-slate-800">{ROLE_LABEL[i.role] || i.role}</span>
                {i.label && <span className="text-slate-500"> - {i.label}</span>}
                {i.state === 'USED' && i.usedBy && <span className="text-slate-500"> - joined as {i.usedBy.name}</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATE_STYLE[i.state]}`}>{i.state.toLowerCase()}</span>
                {i.state === 'PENDING' && <button onClick={() => revoke(i.id)} className="text-rose-600 hover:text-rose-800" aria-label="Cancel invite"><XCircle className="w-4 h-4" /></button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
