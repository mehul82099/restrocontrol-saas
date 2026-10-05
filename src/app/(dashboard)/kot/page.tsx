'use client';

import React, { useState, useEffect } from 'react';
import { useOutlet } from '../layout';
import {
  ChefHat,
  Clock,
  CheckCircle,
  Play,
  Check,
  Utensils,
  RefreshCw,
  AlertCircle,
  BellRing,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export default function KotPage() {
  const { activeOutletId } = useOutlet();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchTickets = async () => {
    if (!activeOutletId) return;
    try {
      const res = await fetch(`/api/kot?outletId=${activeOutletId}`);
      const data = await res.json();
      if (data.success) {
        setTickets(data.tickets || []);
        setLastRefreshed(new Date());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 5000); // 5s auto-refresh
    return () => clearInterval(interval);
  }, [activeOutletId]);

  const updateStatus = async (ticketId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/kot/${ticketId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchTickets();
      }
    } catch (e: any) {
      alert(`Error updating ticket: ${e.message}`);
    }
  };

  const getElapsedMinutes = (dateStr: string) => {
    const elapsed = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    return elapsed;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
        return <Badge variant="warning">NEW TICKET</Badge>;
      case 'ACCEPTED':
        return <Badge variant="pending">ACCEPTED</Badge>;
      case 'PREPARING':
        return <Badge variant="info">PREPARING</Badge>;
      case 'READY':
        return <Badge variant="approved">READY TO SERVE</Badge>;
      default:
        return <Badge variant="normal">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto select-none">
      {/* KDS Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-5 rounded-3xl shadow-lg border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-md">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">
              Kitchen Display System (KDS)
            </h1>
            <p className="text-xs text-slate-400">
              Live order preparation board • {tickets.length} active tickets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            Auto-refreshing (every 5s) • Updated {lastRefreshed.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchTickets}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors"
            title="Refresh now"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Ticket Grid */}
      {loading && tickets.length === 0 ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 shadow-sm">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700 text-base">Kitchen is all clear!</h3>
          <p className="text-xs text-slate-400 mt-1">No pending orders to prepare right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
          {tickets.map((ticket) => {
            const mins = getElapsedMinutes(ticket.createdAt);
            const isDelayed = mins > 15;
            const isCritical = mins > 25;

            return (
              <div
                key={ticket.id}
                className={`bg-white rounded-3xl border-2 shadow-sm flex flex-col justify-between overflow-hidden transition-all ${
                  isCritical
                    ? 'border-rose-400 ring-2 ring-rose-200/50'
                    : isDelayed
                    ? 'border-amber-300'
                    : 'border-slate-200'
                }`}
              >
                {/* Ticket Top Banner */}
                <div
                  className={`p-4 border-b flex items-center justify-between ${
                    ticket.status === 'READY'
                      ? 'bg-emerald-50 border-emerald-100'
                      : ticket.status === 'PREPARING'
                      ? 'bg-blue-50 border-blue-100'
                      : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  <div>
                    <span className="font-black text-slate-900 text-sm">{ticket.kotNumber}</span>
                    <span className="text-[11px] text-slate-500 block font-semibold">
                      Order: {ticket.order?.orderNumber}
                    </span>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {getStatusBadge(ticket.status)}
                    <span
                      className={`text-[10px] font-extrabold flex items-center gap-1 ${
                        isCritical
                          ? 'text-rose-600 animate-pulse'
                          : isDelayed
                          ? 'text-amber-600'
                          : 'text-slate-400'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>{mins}m elapsed</span>
                    </span>
                  </div>
                </div>

                {/* Table & Type Info */}
                <div className="px-4 py-2 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>
                    {ticket.order?.table?.tableNumber
                      ? `Table: ${ticket.order.table.tableNumber}`
                      : ticket.order?.orderType}
                  </span>
                  <span className="text-[10px] text-slate-400 capitalize">
                    {ticket.order?.orderType.replace('_', ' ').toLowerCase()}
                  </span>
                </div>

                {/* Ticket Items List */}
                <div className="p-4 flex-1 space-y-3 divide-y divide-slate-100">
                  {ticket.items.map((item: any) => (
                    <div key={item.id} className="pt-2 first:pt-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-black text-slate-900 text-sm">
                          {item.quantity}x {item.orderItem?.name}
                        </span>
                      </div>
                      {item.notes && (
                        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-1.5 mt-1 border border-amber-200/60 font-semibold">
                          ⚠️ {item.notes}
                        </p>
                      )}
                    </div>
                  ))}

                  {ticket.notes && (
                    <div className="pt-2 text-xs text-slate-500 italic">
                      Special Order Note: &quot;{ticket.notes}&quot;
                    </div>
                  )}
                </div>

                {/* Status Progression Footer */}
                <div className="p-3 bg-slate-50 border-t border-slate-100">
                  {ticket.status === 'NEW' && (
                    <button
                      onClick={() => updateStatus(ticket.id, 'ACCEPTED')}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Check className="w-4 h-4" />
                      <span>Accept Ticket</span>
                    </button>
                  )}

                  {ticket.status === 'ACCEPTED' && (
                    <button
                      onClick={() => updateStatus(ticket.id, 'PREPARING')}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Play className="w-4 h-4" />
                      <span>Start Preparing</span>
                    </button>
                  )}

                  {ticket.status === 'PREPARING' && (
                    <button
                      onClick={() => updateStatus(ticket.id, 'READY')}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition-all"
                    >
                      <BellRing className="w-4 h-4" />
                      <span>Mark Food Ready</span>
                    </button>
                  )}

                  {ticket.status === 'READY' && (
                    <button
                      onClick={() => updateStatus(ticket.id, 'SERVED')}
                      className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition-all"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Mark Served (Archive)</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
