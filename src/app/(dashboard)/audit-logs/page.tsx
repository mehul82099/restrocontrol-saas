'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  Eye,
  Calendar,
  User,
  ShieldCheck,
  FileCode,
  Lock,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatDate } from '@/lib/utils';

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  beforeState?: any;
  afterState?: any;
  ipAddress?: string;
  createdAt: string;
  user?: {
    name: string;
    email: string;
    role: string;
  };
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const url = selectedAction !== 'ALL' ? `/api/audit-logs?action=${selectedAction}` : '/api/audit-logs';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedAction]);

  const filteredLogs = logs.filter((l) => {
    const matchesSearch =
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.entity.toLowerCase().includes(search.toLowerCase()) ||
      l.user?.name.toLowerCase().includes(search.toLowerCase()) ||
      l.user?.email.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const getActionBadge = (action: string) => {
    if (action.includes('CANCEL') || action.includes('REFUND') || action.includes('DELETE')) {
      return <Badge variant="danger">{action}</Badge>;
    }
    if (action.includes('UPDATE') || action.includes('ADJUSTMENT') || action.includes('WASTAGE')) {
      return <Badge variant="warning">{action}</Badge>;
    }
    return <Badge variant="success">{action}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-emerald-600" />
            Security & Operational Audit Trail
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Immutable, append-only log recording every sensitive financial and inventory operation
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Auditable Events</span>
            <Lock className="w-5 h-5 text-slate-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{logs.length}</span>
            <span className="text-xs text-slate-500">recorded</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Storage Guarantee</span>
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-lg font-bold text-slate-900">Immutable Ledger</span>
            <span className="text-xs text-emerald-600 font-medium">Non-deletable</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sensitive Operations</span>
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-600">
              {logs.filter((l) => l.action.includes('CANCEL') || l.action.includes('REFUND') || l.action.includes('ADJUSTMENT')).length}
            </span>
            <span className="text-xs text-amber-600 font-medium">financial overrides</span>
          </div>
        </div>
      </div>

      {/* Table & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by action, user, or entity..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
            >
              <option value="ALL">All Actions</option>
              <option value="LOGIN">LOGIN</option>
              <option value="ORDER_CANCEL">ORDER_CANCEL</option>
              <option value="ORDER_REFUND">ORDER_REFUND</option>
              <option value="INVENTORY_ADJUSTMENT">INVENTORY_ADJUSTMENT</option>
              <option value="WASTAGE_RECORD">WASTAGE_RECORD</option>
              <option value="RECIPE_CREATE">RECIPE_CREATE</option>
              <option value="MENU_ITEM_CREATE">MENU_ITEM_CREATE</option>
              <option value="RESTAURANT_UPDATE">RESTAURANT_UPDATE</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading audit trail...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <ShieldAlert className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">No matching audit logs</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User & Role</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Entity</th>
                  <th className="py-3 px-4">Record ID</th>
                  <th className="py-3 px-4 text-center">State Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-xs text-slate-500 font-mono">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-900">{log.user?.name || 'System / Service'}</span>
                        {log.user?.role && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                            {log.user.role}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">{getActionBadge(log.action)}</td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-700">
                      {log.entity}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-400">
                      {log.entityId ? log.entityId.slice(0, 12) + '...' : '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {(log.beforeState || log.afterState) ? (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <FileCode className="w-3.5 h-3.5" /> View Diff
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* State Inspector Modal */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={`Audit Event: ${selectedLog.action}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px] block">Entity</span>
                <span className="font-bold text-slate-900">{selectedLog.entity}</span>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px] block">User</span>
                <span className="font-medium text-slate-900">{selectedLog.user?.name || 'Automated'}</span>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px] block">Time</span>
                <span className="font-mono text-slate-700">{formatDate(selectedLog.createdAt)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">
                  State Before Action
                </span>
                <pre className="p-3 bg-slate-900 text-slate-300 rounded-xl text-xs font-mono max-h-60 overflow-y-auto">
                  {selectedLog.beforeState ? JSON.stringify(selectedLog.beforeState, null, 2) : 'None / Newly Created'}
                </pre>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">
                  State After Action
                </span>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-xs font-mono max-h-60 overflow-y-auto">
                  {selectedLog.afterState ? JSON.stringify(selectedLog.afterState, null, 2) : 'None / Voided'}
                </pre>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
