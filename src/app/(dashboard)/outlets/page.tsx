'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  MapPin,
  Phone,
  UtensilsCrossed,
  Receipt,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

interface Outlet {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  _count?: {
    tables: number;
    orders: number;
  };
}

export default function OutletsPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchOutlets = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/outlets');
      const data = await res.json();
      if (data.success) {
        setOutlets(data.outlets);
      }
    } catch (err) {
      console.error('Failed to load outlets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutlets();
  }, []);

  const handleAddOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch('/api/outlets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code, address, phone, isDefault }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to add outlet');

      setIsModalOpen(false);
      setName('');
      setCode('');
      setAddress('');
      setPhone('');
      setIsDefault(false);
      await fetchOutlets();
    } catch (err: any) {
      alert(err.message || 'Error creating outlet');
    } finally {
      setSaving(false);
    }
  };

  const totalTables = outlets.reduce((sum, o) => sum + (o._count?.tables || 0), 0);
  const totalOrders = outlets.reduce((sum, o) => sum + (o._count?.orders || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-7 h-7 text-emerald-600" />
            Multi-Outlet Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage restaurant branches, separate inventories, outlet-specific dining tables, and POS terminals
          </p>
        </div>
        <button
          onClick={() => {
            setCode(`OUT-${outlets.length + 1}`);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Branch / Outlet
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Locations</span>
            <Building2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{outlets.length}</span>
            <span className="text-xs text-slate-500">outlets</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Floor Tables</span>
            <UtensilsCrossed className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-indigo-600">{totalTables}</span>
            <span className="text-xs text-slate-500">across all branches</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Branch Isolation</span>
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-lg font-bold text-slate-900">Separate Ledgers</span>
            <span className="text-xs text-emerald-600 font-medium">100% Isolated</span>
          </div>
        </div>
      </div>

      {/* Outlets Grid */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          Loading outlets...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {outlets.map((outlet) => (
            <div
              key={outlet.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
                      {outlet.name}
                      {outlet.isDefault && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                          Primary HQ
                        </span>
                      )}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-400 block mt-0.5">
                      Code: {outlet.code}
                    </span>
                  </div>
                  <Badge variant="success">ACTIVE</Badge>
                </div>

                <div className="mt-4 space-y-2 text-xs text-slate-600">
                  {outlet.address && (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <span>{outlet.address}</span>
                    </div>
                  )}
                  {outlet.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-mono">{outlet.phone}</span>
                    </div>
                  )}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 uppercase font-bold text-[10px] block">Dining Tables</span>
                    <span className="font-extrabold text-slate-900 text-sm">{outlet._count?.tables || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase font-bold text-[10px] block">Total Orders</span>
                    <span className="font-extrabold text-slate-900 text-sm">{outlet._count?.orders || 0}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span>Multi-tenant secure</span>
                <span className="text-emerald-600 font-semibold">Inventory Linked</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Outlet Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Restaurant Outlet / Branch">
        <form onSubmit={handleAddOutlet} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Outlet / Branch Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Connaught Place Branch, Downtown Cafe"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Branch Code *</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. OUT-02"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 00000"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Building, Road, City, PIN"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="isDefault" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Set as Default / Primary HQ Outlet
            </label>
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
              {saving ? 'Creating...' : 'Create Branch'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
