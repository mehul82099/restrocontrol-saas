'use client';
import { useEffect, useState } from 'react';
import { useOutlet } from '../layout';

type Session = {id: string; staffName: string; staffRole: string; checkedInAt: string; checkedOutAt: string | null; checkoutReason: string | null; systemEstimated: boolean};
export default function AttendancePage() {
  const {user} = useOutlet();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [days, setDays] = useState('7');
  const [range, setRange] = useState({from: '', to: ''});
  async function load(more = false) {
    setLoading(true); setError('');
    const nextRange = more ? range : {from: new Date(Date.now() - Number(days) * 86400000).toISOString(), to: new Date().toISOString()};
    try {
      const params = new URLSearchParams(nextRange);
      if (more && cursor) params.set('cursor', cursor);
      const res = await fetch(`/api/attendance?${params}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Attendance could not be loaded.');
      setSessions(old => more ? [...old, ...data.sessions] : data.sessions);
      setCursor(data.nextCursor); setTimezone(data.timezone); setRange(nextRange);
    } catch (e: any) { setError(e.message || 'Attendance could not be loaded.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (user && ['OWNER', 'MANAGER'].includes(user.role)) load(); }, [user, days]);
  if (!user || !['OWNER', 'MANAGER'].includes(user.role)) return <p className="text-slate-700">Attendance is available to Owner and Manager only.</p>;
  const format = (date: string) => new Date(date).toLocaleString('en-IN', {timeZone: timezone, dateStyle: 'medium', timeStyle: 'short'});
  return <div className="space-y-5 max-w-6xl">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-slate-900">Staff attendance</h1><p className="text-sm text-slate-500 mt-1">Login and logout records in {timezone}</p></div>
      <div className="flex gap-2 items-center"><label className="sr-only" htmlFor="attendance-range">Date range</label><select id="attendance-range" className="border rounded-lg p-2 bg-white text-sm" value={days} onChange={e => setDays(e.target.value)}><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="31">Last 31 days</option></select><button className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50" disabled={loading} onClick={() => load()}>Refresh</button></div>
    </div>
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">Each login is a separate session, including multiple devices. Check-in means successful login. If staff do not log out, check-out is the session expiry time and is marked system-estimated. This is not proof of physical presence or a payroll hours total. Records begin after this feature is enabled; owners are not tracked.</div>
    {error && <p role="alert" className="text-red-700 bg-red-50 p-3 rounded-lg">{error} Use Refresh to retry.</p>}
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full text-sm text-left min-w-[660px]">
        <thead className="bg-slate-100 text-slate-600"><tr>{['Staff', 'Role', 'Check-in', 'Check-out', 'Source'].map(h => <th className="p-4 font-semibold" key={h}>{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{sessions.map(s => <tr key={s.id}><td className="p-4 font-semibold text-slate-900">{s.staffName}</td><td className="p-4 text-slate-600">{s.staffRole.replaceAll('_', ' ')}</td><td className="p-4 whitespace-nowrap">{format(s.checkedInAt)}</td><td className="p-4 whitespace-nowrap">{s.checkedOutAt ? format(s.checkedOutAt) : 'Still signed in'}</td><td className="p-4">{s.systemEstimated ? <span className="text-amber-800">Session expired<br/><span className="text-xs">System-estimated</span></span> : s.checkoutReason === 'LOGOUT' ? 'Logout' : 'Open session'}</td></tr>)}</tbody>
      </table></div>
      {!sessions.length && !loading && !error && <p className="p-8 text-center text-slate-500">No staff logins in this range.</p>}
      {loading && <p role="status" className="p-4 text-slate-500">Loading attendance...</p>}
    </div>
    {cursor && <button disabled={loading} className="border bg-white rounded-lg px-4 py-2 text-sm disabled:opacity-50" onClick={() => load(true)}>Load older sessions</button>}
  </div>;
}
