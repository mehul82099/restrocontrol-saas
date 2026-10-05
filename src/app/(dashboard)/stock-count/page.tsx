'use client';

import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Scale,
  Calendar,
  User,
  Eye,
  FileCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency, formatDate } from '@/lib/utils';

interface StockCountItem {
  id?: string;
  ingredientId: string;
  systemStock: number;
  physicalStock: number;
  varianceQuantity: number;
  varianceCost: number;
  unit: string;
  reason?: string;
  ingredient: {
    name: string;
    unit: string;
    costPerUnit: number;
  };
}

interface StockCount {
  id: string;
  countNumber: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  totalVarianceCost: number;
  notes?: string;
  createdAt: string;
  conductedBy?: { name: string };
  approvedBy?: { name: string };
  items: StockCountItem[];
}

interface IngredientMaster {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  costPerUnit: number;
}

export default function StockCountPage() {
  const [counts, setCounts] = useState<StockCount[]>([]);
  const [ingredients, setIngredients] = useState<IngredientMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAudit, setSelectedAudit] = useState<StockCount | null>(null);

  // New Audit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [auditNotes, setAuditNotes] = useState('');
  const [auditInputs, setAuditInputs] = useState<{
    [ingredientId: string]: { physicalStock: string; reason: string };
  }>({});

  const fetchData = async () => {
    try {
      setLoading(true);
      const [countRes, ingRes] = await Promise.all([
        fetch('/api/stock-count').then((r) => r.json()),
        fetch('/api/ingredients').then((r) => r.json()),
      ]);

      if (countRes.counts) setCounts(countRes.counts);
      if (ingRes.ingredients) setIngredients(ingRes.ingredients);
    } catch (err) {
      console.error('Failed to load stock audits', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAuditModal = () => {
    const initial: { [key: string]: { physicalStock: string; reason: string } } = {};
    ingredients.forEach((ing) => {
      initial[ing.id] = {
        physicalStock: ing.currentStock.toString(),
        reason: 'Routine Weekly Audit',
      };
    });
    setAuditInputs(initial);
    setAuditNotes('');
    setIsModalOpen(true);
  };

  const handleInputChange = (id: string, field: 'physicalStock' | 'reason', value: string) => {
    setAuditInputs((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleAuditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const itemsToSubmit = Object.entries(auditInputs).map(([ingredientId, val]) => ({
        ingredientId,
        physicalStock: parseFloat(val.physicalStock) || 0,
        reason: val.reason,
      }));

      const res = await fetch('/api/stock-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsToSubmit,
          notes: auditNotes,
          autoApprove: true, // auto approve if owner performs count
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to submit stock count');

      setIsModalOpen(false);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Error submitting stock audit');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id: string, approve: boolean) => {
    try {
      const res = await fetch(`/api/stock-count/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approve }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to process audit');

      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Error updating audit status');
    }
  };

  const totalVarianceImpact = counts
    .filter((c) => c.status === 'APPROVED')
    .reduce((sum, c) => sum + (c.totalVarianceCost || 0), 0);

  const pendingCount = counts.filter((c) => c.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-emerald-600" />
            Physical Stock Audit & Counting
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Reconcile physical on-shelf stock against ledger projections to discover and adjust inventory variances
          </p>
        </div>
        <button
          onClick={openAuditModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-all"
        >
          <Plus className="w-4 h-4" />
          Conduct Stock Count
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Audits Conducted</span>
            <FileCheck className="w-5 h-5 text-slate-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{counts.length}</span>
            <span className="text-xs text-slate-500">audits logged</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Variance Impact</span>
            <Scale className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold ${totalVarianceImpact < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {formatCurrency(totalVarianceImpact)}
            </span>
            <span className="text-xs text-slate-500">reconciliation value</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Manager Sign-off</span>
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-600">{pendingCount}</span>
            <span className="text-xs text-slate-500">pending audits</span>
          </div>
        </div>
      </div>

      {/* Audit History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Audit History & Approvals</h3>
          <span className="text-xs text-slate-500 font-medium">Auto-creates STOCK_COUNT ledger movements upon approval</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading audit records...</div>
        ) : counts.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <ClipboardCheck className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">No stock counts conducted yet</p>
            <p className="text-sm text-slate-500 mt-1">Run a physical count to sync shelf inventory with the ledger.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Audit Code</th>
                  <th className="py-3 px-4">Date Conducted</th>
                  <th className="py-3 px-4">Conducted By</th>
                  <th className="py-3 px-4 text-center">Items Audited</th>
                  <th className="py-3 px-4 text-right">Net Cost Variance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {counts.map((audit) => (
                  <tr key={audit.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{audit.countNumber}</td>
                    <td className="py-3 px-4 text-xs text-slate-500 font-mono">{formatDate(audit.createdAt)}</td>
                    <td className="py-3 px-4 text-slate-700 text-xs flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {audit.conductedBy?.name || 'Manager'}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-slate-800">
                      {audit.items?.length || 0}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span className={audit.totalVarianceCost < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                        {formatCurrency(audit.totalVarianceCost)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {audit.status === 'APPROVED' ? (
                        <Badge variant="success">APPROVED</Badge>
                      ) : audit.status === 'PENDING' ? (
                        <Badge variant="warning">PENDING</Badge>
                      ) : (
                        <Badge variant="danger">REJECTED</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedAudit(audit)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" /> Breakdown
                        </button>
                        {audit.status === 'PENDING' && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleApprove(audit.id, true)}
                              className="p-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md"
                              title="Approve & Adjust Ledger"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleApprove(audit.id, false)}
                              className="p-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-md"
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Conduct Count Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Physical Stock Audit & Count Sheet"
        size="lg"
      >
        <form onSubmit={handleAuditSubmit} className="space-y-4">
          <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
            Enter the verified physical quantities found on shelves. The system will automatically compute differences
            and update the immutable inventory ledger upon approval.
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 sticky top-0 font-bold text-slate-600 uppercase">
                <tr>
                  <th className="py-2 px-3">Ingredient</th>
                  <th className="py-2 px-3 text-right">System Stock</th>
                  <th className="py-2 px-3 text-right">Physical Count</th>
                  <th className="py-2 px-3 text-right">Variance</th>
                  <th className="py-2 px-3">Audit Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ingredients.map((ing) => {
                  const input = auditInputs[ing.id] || { physicalStock: ing.currentStock.toString(), reason: '' };
                  const physicalNum = parseFloat(input.physicalStock) || 0;
                  const variance = Math.round((physicalNum - ing.currentStock) * 100) / 100;

                  return (
                    <tr key={ing.id} className="hover:bg-slate-50/60">
                      <td className="py-2 px-3 font-semibold text-slate-900">{ing.name}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-500">
                        {ing.currentStock.toFixed(2)} {ing.unit}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={input.physicalStock}
                          onChange={(e) => handleInputChange(ing.id, 'physicalStock', e.target.value)}
                          className="w-24 px-2 py-1 bg-white border border-slate-200 rounded text-right font-mono font-bold text-slate-900"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold">
                        <span className={variance < 0 ? 'text-rose-600' : variance > 0 ? 'text-emerald-600' : 'text-slate-400'}>
                          {variance > 0 ? `+${variance}` : variance} {ing.unit}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={input.reason}
                          onChange={(e) => handleInputChange(ing.id, 'reason', e.target.value)}
                          placeholder="e.g. Spillage / Routine Count"
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-[11px]"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Overall Audit Notes</label>
            <input
              type="text"
              value={auditNotes}
              onChange={(e) => setAuditNotes(e.target.value)}
              placeholder="e.g. End of Month Full Kitchen Audit"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
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
              {saving ? 'Processing...' : 'Submit & Adjust Stock'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Breakdown Modal */}
      {selectedAudit && (
        <Modal
          isOpen={!!selectedAudit}
          onClose={() => setSelectedAudit(null)}
          title={`Audit Breakdown: ${selectedAudit.countNumber}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px]">Date</span>
                <p className="font-semibold text-slate-800">{formatDate(selectedAudit.createdAt)}</p>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px]">Conducted By</span>
                <p className="font-semibold text-slate-800">{selectedAudit.conductedBy?.name || 'Staff'}</p>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px]">Net Impact</span>
                <p className={`font-bold font-mono ${selectedAudit.totalVarianceCost < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {formatCurrency(selectedAudit.totalVarianceCost)}
                </p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Ingredient</th>
                    <th className="py-2.5 px-3 text-right">System Stock</th>
                    <th className="py-2.5 px-3 text-right">Physical Stock</th>
                    <th className="py-2.5 px-3 text-right">Variance Qty</th>
                    <th className="py-2.5 px-3 text-right">Cost Impact</th>
                    <th className="py-2.5 px-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedAudit.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-semibold text-slate-900">{item.ingredient?.name}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-500">
                        {item.systemStock} {item.unit}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {item.physicalStock} {item.unit}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold">
                        <span className={item.varianceQuantity < 0 ? 'text-rose-600' : item.varianceQuantity > 0 ? 'text-emerald-600' : 'text-slate-400'}>
                          {item.varianceQuantity > 0 ? `+${item.varianceQuantity}` : item.varianceQuantity} {item.unit}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold">
                        <span className={item.varianceCost < 0 ? 'text-rose-600' : item.varianceCost > 0 ? 'text-emerald-600' : 'text-slate-400'}>
                          {formatCurrency(item.varianceCost)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-500">{item.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
