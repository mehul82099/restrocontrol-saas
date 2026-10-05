'use client';

import React, { useState, useEffect } from 'react';
import { useOutlet } from '../layout';
import {
  Boxes,
  History,
  SlidersHorizontal,
  Search,
  Plus,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  Download,
  ShieldCheck,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

export default function InventoryPage() {
  const { activeOutletId } = useOutlet();
  const [activeTab, setActiveTab] = useState<'stock' | 'ledger'>('stock');

  // Stock Projection State
  const [stockList, setStockList] = useState<any[]>([]);
  const [loadingStock, setLoadingStock] = useState(true);
  const [stockSearch, setStockSearch] = useState('');

  // Ledger Movements State
  const [movements, setMovements] = useState<any[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [selectedMovementType, setSelectedMovementType] = useState('ALL');

  // Adjustment Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustIngredient, setAdjustIngredient] = useState<any>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustType, setAdjustType] = useState<'ADJUSTMENT' | 'OPENING'>('ADJUSTMENT');
  const [adjustReason, setAdjustReason] = useState('');
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  const fetchStock = async () => {
    if (!activeOutletId) return;
    setLoadingStock(true);
    try {
      const res = await fetch(`/api/inventory?outletId=${activeOutletId}`);
      const data = await res.json();
      if (data.success) {
        setStockList(data.stock || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingStock(false);
    }
  };

  const fetchLedger = async () => {
    if (!activeOutletId) return;
    setLoadingLedger(true);
    try {
      const typeParam = selectedMovementType !== 'ALL' ? `&movementType=${selectedMovementType}` : '';
      const res = await fetch(`/api/inventory/ledger?outletId=${activeOutletId}${typeParam}&limit=100`);
      const data = await res.json();
      if (data.success) {
        setMovements(data.movements || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingLedger(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, [activeOutletId]);

  useEffect(() => {
    if (activeTab === 'ledger') {
      fetchLedger();
    }
  }, [activeOutletId, activeTab, selectedMovementType]);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustIngredient || adjustQty === 0) return;
    setIsSubmittingAdjust(true);

    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredientId: adjustIngredient.ingredientId,
          movementType: adjustType,
          quantity: adjustQty,
          reason: adjustReason,
        }),
      });

      if (res.ok) {
        setShowAdjustModal(false);
        setAdjustQty(0);
        setAdjustReason('');
        fetchStock();
      }
    } catch (e: any) {
      alert(`Adjustment error: ${e.message}`);
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  const filteredStock = stockList.filter((s) =>
    s.name.toLowerCase().includes(stockSearch.toLowerCase()) ||
    s.category.toLowerCase().includes(stockSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Inventory & Ledger Management
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Live stock projection paired with an immutable, auditable movement ledger.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm text-xs">
          <button
            onClick={() => setActiveTab('stock')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold transition-all ${
              activeTab === 'stock'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Stock Projection</span>
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold transition-all ${
              activeTab === 'ledger'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Immutable Ledger</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Stock Projection */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                placeholder="Filter ingredients..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`/api/reports?type=current_stock&outletId=${activeOutletId}&format=csv`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </a>
            </div>
          </div>

          {/* Stock Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Ingredient</th>
                  <th className="px-4 py-4">Category</th>
                  <th className="px-4 py-4 text-right">Available Stock</th>
                  <th className="px-4 py-4 text-right">Min Stock</th>
                  <th className="px-4 py-4 text-right">Reorder Level</th>
                  <th className="px-4 py-4 text-right">Unit Cost</th>
                  <th className="px-4 py-4 text-right">Total Value</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingStock ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400">
                      Loading inventory stock...
                    </td>
                  </tr>
                ) : filteredStock.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400">
                      No ingredients found.
                    </td>
                  </tr>
                ) : (
                  filteredStock.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-extrabold text-slate-900 text-sm">{item.name}</span>
                        <span className="text-[10px] text-slate-400 block">Vendor: {item.preferredSupplier}</span>
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-600">{item.category}</td>
                      <td className="px-4 py-4 text-right font-black text-slate-900 text-sm">
                        {item.currentStock} {item.unit}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-500 font-medium">
                        {item.minimumStock} {item.unit}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-500 font-medium">
                        {item.reorderLevel} {item.unit}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-700">
                        {formatCurrency(item.costPerUnit)}
                      </td>
                      <td className="px-4 py-4 text-right font-extrabold text-slate-900">
                        {formatCurrency(item.totalValue)}
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          variant={
                            item.status === 'CRITICAL'
                              ? 'critical'
                              : item.status === 'LOW_STOCK'
                              ? 'low_stock'
                              : item.status === 'WARNING'
                              ? 'warning'
                              : 'normal'
                          }
                        >
                          {item.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setAdjustIngredient(item);
                            setAdjustQty(0);
                            setAdjustReason('');
                            setShowAdjustModal(true);
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Immutable Ledger */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          {/* Movement Type Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs">
            {[
              'ALL',
              'SALE_CONSUMPTION',
              'PURCHASE',
              'WASTAGE',
              'STOCK_COUNT',
              'ADJUSTMENT',
              'OPENING',
            ].map((t) => (
              <button
                key={t}
                onClick={() => setSelectedMovementType(t)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                  selectedMovementType === t
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Ledger Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-4 py-4">Ingredient</th>
                  <th className="px-4 py-4">Movement Type</th>
                  <th className="px-4 py-4 text-right">Quantity</th>
                  <th className="px-4 py-4 text-right">Cost/Unit</th>
                  <th className="px-4 py-4 text-right">Total Impact</th>
                  <th className="px-6 py-4">Reference & Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {loadingLedger ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400 font-sans">
                      Loading immutable ledger history...
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400 font-sans">
                      No ledger records found for this filter.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => {
                    const isAddition = m.quantity > 0;
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-3.5 text-slate-500 font-sans text-[11px]">
                          {formatDate(m.createdAt)}
                        </td>
                        <td className="px-4 py-3.5 font-sans font-bold text-slate-900">
                          {m.ingredient.name}
                        </td>
                        <td className="px-4 py-3.5 font-sans">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              m.movementType === 'SALE_CONSUMPTION'
                                ? 'bg-indigo-50 text-indigo-700'
                                : m.movementType === 'PURCHASE'
                                ? 'bg-emerald-50 text-emerald-700'
                                : m.movementType === 'WASTAGE'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {m.movementType}
                          </span>
                        </td>
                        <td
                          className={`px-4 py-3.5 text-right font-black text-xs ${
                            isAddition ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {isAddition ? `+${m.quantity}` : m.quantity} {m.unit}
                        </td>
                        <td className="px-4 py-3.5 text-right font-sans text-slate-600">
                          {formatCurrency(m.costPerUnit)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-sans font-extrabold text-slate-900">
                          {formatCurrency(m.totalCost)}
                        </td>
                        <td className="px-6 py-3.5 font-sans text-slate-500 text-[11px]">
                          <span className="font-semibold text-slate-700 block">
                            {m.referenceType} {m.referenceId ? `#${m.referenceId.slice(-8)}` : ''}
                          </span>
                          <span className="text-[10px] text-slate-400">{m.reason}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Manual Stock Adjustment */}
      <Modal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        title={`Adjust Stock for ${adjustIngredient?.name || ''}`}
        maxWidth="md"
      >
        <form onSubmit={handleAdjustSubmit} className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-xl text-xs flex justify-between">
            <span className="text-slate-500">Current In-Stock:</span>
            <span className="font-black text-slate-900">
              {adjustIngredient?.currentStock} {adjustIngredient?.unit}
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Adjustment Quantity ({adjustIngredient?.unit})
            </label>
            <p className="text-[11px] text-slate-400 mb-2">
              Use positive numbers to add stock, negative to deduct.
            </p>
            <input
              type="number"
              step="0.001"
              required
              value={adjustQty || ''}
              onChange={(e) => setAdjustQty(parseFloat(e.target.value) || 0)}
              placeholder="e.g. 5 or -2.5"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Reason for Adjustment
            </label>
            <textarea
              required
              rows={2}
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="e.g. Supplier delivered extra sample, kitchen miscount correction..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmittingAdjust || adjustQty === 0}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-md transition-all disabled:opacity-40"
          >
            {isSubmittingAdjust ? 'Recording Movement...' : 'Apply Ledger Adjustment'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
