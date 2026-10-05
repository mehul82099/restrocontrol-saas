'use client';

import React, { useState, useEffect } from 'react';
import {
  Trash2,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Clock,
  DollarSign,
  TrendingDown,
  User,
  ShieldAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency, formatDate } from '@/lib/utils';

interface WastageRecord {
  id: string;
  ingredientId: string;
  quantity: number;
  unit: string;
  costImpact: number;
  reason: string;
  notes?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  ingredient: {
    name: string;
    unit: string;
  };
  reportedBy?: {
    name: string;
  };
  approvedBy?: {
    name: string;
  };
}

interface IngredientOption {
  id: string;
  name: string;
  unit: string;
  costPerUnit: number;
}

export default function WastagePage() {
  const [wastages, setWastages] = useState<WastageRecord[]>([]);
  const [ingredients, setIngredients] = useState<IngredientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Log Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ingredientId, setIngredientId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('KG');
  const [reason, setReason] = useState('SPOILED');
  const [notes, setNotes] = useState('');

  const fetchWastages = async () => {
    try {
      setLoading(true);
      const [wRes, iRes] = await Promise.all([
        fetch('/api/wastage').then((r) => r.json()),
        fetch('/api/ingredients').then((r) => r.json()),
      ]);

      if (wRes.wastages) setWastages(wRes.wastages);
      if (iRes.ingredients) setIngredients(iRes.ingredients);
    } catch (err) {
      console.error('Failed to load wastage records', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWastages();
  }, []);

  const handleIngredientChange = (id: string) => {
    setIngredientId(id);
    const ing = ingredients.find((i) => i.id === id);
    if (ing) {
      setUnit(ing.unit);
    }
  };

  const handleLogWastage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch('/api/wastage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredientId,
          quantity,
          unit,
          reason,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to log wastage');

      setIsModalOpen(false);
      setQuantity('');
      setNotes('');
      await fetchWastages();
    } catch (err: any) {
      alert(err.message || 'Error recording wastage');
    } finally {
      setSaving(false);
    }
  };

  const handleApproval = async (id: string, approve: boolean) => {
    try {
      const res = await fetch(`/api/wastage/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approve }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to process approval');

      await fetchWastages();
    } catch (err: any) {
      alert(err.message || 'Approval error');
    }
  };

  const totalCost = wastages
    .filter((w) => w.status === 'APPROVED')
    .reduce((sum, w) => sum + (w.costImpact || 0), 0);

  const pendingCount = wastages.filter((w) => w.status === 'PENDING').length;

  const filtered = wastages.filter((w) => {
    const matchesStatus = filterStatus === 'ALL' || w.status === filterStatus;
    const matchesSearch =
      w.ingredient.name.toLowerCase().includes(search.toLowerCase()) ||
      w.reason.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Trash2 className="w-7 h-7 text-rose-600" />
            Kitchen Wastage & Spoilage Log
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track kitchen preparation loss, expired goods, and burn rate with mandatory manager audit trail
          </p>
        </div>
        <button
          onClick={() => {
            if (ingredients.length > 0) handleIngredientChange(ingredients[0].id);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-all"
        >
          <Plus className="w-4 h-4" />
          Log Kitchen Wastage
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approved Wastage Cost</span>
            <DollarSign className="w-5 h-5 text-rose-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-600">{formatCurrency(totalCost)}</span>
            <span className="text-xs text-slate-500">total write-off</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Manager Review</span>
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-600">{pendingCount}</span>
            <span className="text-xs text-slate-500">requests</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Recorded Incidents</span>
            <AlertOctagon className="w-5 h-5 text-slate-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{wastages.length}</span>
            <span className="text-xs text-slate-500">logged</span>
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
              placeholder="Search ingredient or reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filterStatus === st ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading wastage records...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Trash2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">No wastage incidents found</p>
            <p className="text-sm text-slate-500 mt-1">Excellent portion control and zero unrecorded waste!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Date / Time</th>
                  <th className="py-3 px-4">Ingredient</th>
                  <th className="py-3 px-4 text-right">Quantity</th>
                  <th className="py-3 px-4 text-right">Cost Loss</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4">Reported By</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Manager Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-xs text-slate-500 font-mono">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{item.ingredient.name}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                      -{item.quantity} {item.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(item.costImpact)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-md text-xs font-semibold">
                        {item.reason}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 max-w-xs truncate">
                      {item.notes || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {item.reportedBy?.name || 'Staff'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.status === 'APPROVED' ? (
                        <Badge variant="success">APPROVED</Badge>
                      ) : item.status === 'PENDING' ? (
                        <Badge variant="warning">PENDING</Badge>
                      ) : (
                        <Badge variant="danger">REJECTED</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.status === 'PENDING' ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleApproval(item.id, true)}
                            title="Approve Wastage"
                            className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-all"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleApproval(item.id, false)}
                            title="Reject Wastage"
                            className="p-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold transition-all"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Wastage Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Log Kitchen Wastage">
        <form onSubmit={handleLogWastage} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Ingredient *</label>
            <select
              value={ingredientId}
              onChange={(e) => handleIngredientChange(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            >
              <option value="">Select ingredient...</option>
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} (Unit: {i.unit}, {formatCurrency(i.costPerUnit)}/{i.unit})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity *</label>
              <input
                type="number"
                step="0.01"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 1.5"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
              <input
                type="text"
                readOnly
                value={unit}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm font-mono text-slate-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reason *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            >
              <option value="SPOILED">SPOILED</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="BURNT">BURNT</option>
              <option value="DAMAGED">DAMAGED</option>
              <option value="PREPARATION_ERROR">PREPARATION_ERROR</option>
              <option value="STAFF_MEAL">STAFF_MEAL</option>
              <option value="OTHER">OTHER</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Description</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Fridge temperature fluctuation overnight"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl shadow-xs disabled:opacity-50"
            >
              {saving ? 'Recording...' : 'Record Wastage'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
