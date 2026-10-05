'use client';

import React, { useState, useEffect } from 'react';
import {
  UtensilsCrossed,
  Plus,
  Users,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  ShoppingBag,
  Store,
  Layers,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';

interface DiningTable {
  id: string;
  tableNumber: string;
  capacity: number;
  section: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'BILLING';
  orders?: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    status: string;
    items: { id: string; name: string; quantity: number }[];
  }[];
}

export default function TablesPage() {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState('ALL');

  // Add Table Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [section, setSection] = useState('Main Dining');
  const [saving, setSaving] = useState(false);

  const fetchTables = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tables');
      const data = await res.json();
      if (data.success) {
        setTables(data.tables);
      }
    } catch (err) {
      console.error('Failed to load tables', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableNumber, capacity, section }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to add table');

      setIsModalOpen(false);
      setTableNumber('');
      await fetchTables();
    } catch (err: any) {
      alert(err.message || 'Error creating table');
    } finally {
      setSaving(false);
    }
  };

  const sections = Array.from(new Set(tables.map((t) => t.section || 'Main Dining')));

  const filteredTables = tables.filter(
    (t) => selectedSection === 'ALL' || t.section === selectedSection
  );

  const occupiedCount = tables.filter(
    (t) => t.status === 'OCCUPIED' || (t.orders && t.orders.length > 0)
  ).length;
  const availableCount = tables.length - occupiedCount;
  const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UtensilsCrossed className="w-7 h-7 text-emerald-600" />
            Dining Floor & Table Occupancy
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Visual table arrangement, active guest covers, and rapid order initiation
          </p>
        </div>
        <button
          onClick={() => {
            setTableNumber(`T${tables.length + 1}`);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Table
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Tables</span>
            <UtensilsCrossed className="w-5 h-5 text-slate-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{tables.length}</span>
            <span className="text-xs text-slate-500">tables configured</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-rose-200/80 shadow-xs bg-rose-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Occupied Dining</span>
            <Clock className="w-5 h-5 text-rose-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-600">{occupiedCount}</span>
            <span className="text-xs text-rose-500 font-medium">with active orders</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-xs bg-emerald-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Available Vacant</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600">{availableCount}</span>
            <span className="text-xs text-emerald-600 font-medium">ready to seat</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Floor Seating Capacity</span>
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{totalCapacity}</span>
            <span className="text-xs text-slate-500">total guest covers</span>
          </div>
        </div>
      </div>

      {/* Section Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedSection('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            selectedSection === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          All Sections ({tables.length})
        </button>
        {sections.map((sec) => (
          <button
            key={sec}
            onClick={() => setSelectedSection(sec)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedSection === sec
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {sec}
          </button>
        ))}
      </div>

      {/* Tables Grid */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          Loading dining floor layout...
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="p-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <UtensilsCrossed className="w-12 h-12 mx-auto text-slate-300 mb-2" />
          <p className="font-semibold text-slate-700">No tables in this section</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredTables.map((tbl) => {
            const hasActiveOrder = tbl.orders && tbl.orders.length > 0;
            const activeOrder = hasActiveOrder ? tbl.orders![0] : null;

            return (
              <div
                key={tbl.id}
                className={`bg-white rounded-2xl border p-4 flex flex-col justify-between transition-all shadow-xs ${
                  hasActiveOrder
                    ? 'border-rose-200 bg-gradient-to-b from-white to-rose-50/20'
                    : 'border-slate-200/80 hover:border-emerald-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xl font-black text-slate-900">Table {tbl.tableNumber}</span>
                      <span className="text-xs text-slate-400 block">{tbl.section}</span>
                    </div>
                    {hasActiveOrder ? (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                        OCCUPIED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        AVAILABLE
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>Up to {tbl.capacity} guests</span>
                  </div>

                  {/* Active Order Card */}
                  {activeOrder && (
                    <div className="mt-3 pt-3 border-t border-rose-100 space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-mono text-slate-600 font-bold">{activeOrder.orderNumber}</span>
                        <span className="font-bold font-mono text-emerald-700">
                          {formatCurrency(activeOrder.totalAmount)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 line-clamp-1">
                        {activeOrder.items?.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <Link
                    href={`/pos?tableId=${tbl.id}`}
                    className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      hasActiveOrder
                        ? 'bg-slate-900 hover:bg-slate-800 text-white'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    <Store className="w-3.5 h-3.5" />
                    {hasActiveOrder ? 'View / Add to Bill' : 'Open POS Ticket'}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Table Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Dining Table">
        <form onSubmit={handleAddTable} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Table Number / Label *</label>
            <input
              type="text"
              required
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="e.g. T1, T2, Rooftop-A"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Seating Capacity *</label>
              <input
                type="number"
                min="1"
                required
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Floor Section</label>
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="e.g. Main Dining, Patio"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Table'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
