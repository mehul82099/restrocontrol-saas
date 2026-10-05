'use client';

import React, { useState, useEffect } from 'react';
import {
  Beef,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  PackageCheck,
  TrendingDown,
  Building2,
  DollarSign,
  Boxes,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/utils';

interface Ingredient {
  id: string;
  name: string;
  sku?: string;
  unit: string;
  costPerUnit: number;
  minimumStock: number;
  reorderLevel: number;
  currentStock: number;
  category: string;
  preferredSupplier: string;
}

interface SupplierOption {
  id: string;
  name: string;
}

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LOW' | 'REORDER'>('ALL');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('KG');
  const [costPerUnit, setCostPerUnit] = useState('100');
  const [minimumStock, setMinimumStock] = useState('5');
  const [reorderLevel, setReorderLevel] = useState('10');
  const [supplierId, setSupplierId] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ingRes, supRes] = await Promise.all([
        fetch('/api/ingredients').then((r) => r.json()),
        fetch('/api/purchases/suppliers').then((r) => r.json()).catch(() => ({ suppliers: [] })),
      ]);

      if (ingRes.ingredients) setIngredients(ingRes.ingredients);
      if (supRes.suppliers) setSuppliers(supRes.suppliers);
    } catch (err) {
      console.error('Failed to load ingredients', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setName('');
    setUnit('KG');
    setCostPerUnit('100');
    setMinimumStock('5');
    setReorderLevel('10');
    setSupplierId('');
    setIsModalOpen(true);
  };

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch('/api/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          unit,
          costPerUnit,
          minimumStock,
          reorderLevel,
          preferredSupplierId: supplierId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save ingredient');

      setIsModalOpen(false);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Error saving ingredient');
    } finally {
      setSaving(false);
    }
  };

  const lowStockCount = ingredients.filter((i) => i.currentStock <= i.minimumStock).length;
  const reorderCount = ingredients.filter(
    (i) => i.currentStock > i.minimumStock && i.currentStock <= i.reorderLevel
  ).length;
  const totalValuation = ingredients.reduce((sum, i) => sum + i.currentStock * i.costPerUnit, 0);

  const filtered = ingredients.filter((ing) => {
    const matchesSearch =
      ing.name.toLowerCase().includes(search.toLowerCase()) ||
      ing.preferredSupplier.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'LOW') return ing.currentStock <= ing.minimumStock;
    if (statusFilter === 'REORDER') return ing.currentStock <= ing.reorderLevel;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Beef className="w-7 h-7 text-emerald-600" />
            Ingredient Master & Stock Thresholds
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Raw materials inventory, safety stock alerts, and preferred vendor procurement
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Ingredient
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Ingredients</span>
            <Boxes className="w-5 h-5 text-slate-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{ingredients.length}</span>
            <span className="text-xs text-slate-500">tracked items</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-rose-200/80 shadow-xs bg-rose-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Critical Low Stock</span>
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-600">{lowStockCount}</span>
            <span className="text-xs text-rose-500 font-medium">below safety level</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-xs bg-amber-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Reorder Required</span>
            <TrendingDown className="w-5 h-5 text-amber-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-600">{reorderCount}</span>
            <span className="text-xs text-amber-600 font-medium">items to replenish</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stock Valuation</span>
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{formatCurrency(totalValuation)}</span>
            <span className="text-xs text-slate-500">asset cost</span>
          </div>
        </div>
      </div>

      {/* Main List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ingredient or vendor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All Items ({ingredients.length})
            </button>
            <button
              onClick={() => setStatusFilter('LOW')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'LOW'
                  ? 'bg-rose-600 text-white'
                  : 'text-rose-600 hover:bg-rose-50 border border-rose-200'
              }`}
            >
              Critical Low ({lowStockCount})
            </button>
            <button
              onClick={() => setStatusFilter('REORDER')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'REORDER'
                  ? 'bg-amber-600 text-white'
                  : 'text-amber-600 hover:bg-amber-50 border border-amber-200'
              }`}
            >
              Reorder Needed ({reorderCount})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading ingredient master...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Beef className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">No ingredients match your filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Ingredient Name</th>
                  <th className="py-3 px-4">Storage Unit</th>
                  <th className="py-3 px-4 text-right">Available Stock</th>
                  <th className="py-3 px-4 text-right">Min Stock</th>
                  <th className="py-3 px-4 text-right">Reorder Level</th>
                  <th className="py-3 px-4 text-right">Cost / Unit</th>
                  <th className="py-3 px-4 text-right">Total Asset</th>
                  <th className="py-3 px-4">Preferred Supplier</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((item) => {
                  const isCritical = item.currentStock <= item.minimumStock;
                  const isReorder = !isCritical && item.currentStock <= item.reorderLevel;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">{item.name}</td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs">
                          {item.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold font-mono">
                        <span className={isCritical ? 'text-rose-600 font-extrabold' : isReorder ? 'text-amber-600' : 'text-slate-900'}>
                          {item.currentStock.toFixed(2)} {item.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500 text-xs">
                        {item.minimumStock} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500 text-xs">
                        {item.reorderLevel} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-700 font-medium">
                        {formatCurrency(item.costPerUnit)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900">
                        {formatCurrency(item.currentStock * item.costPerUnit)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {item.preferredSupplier}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isCritical ? (
                          <Badge variant="danger">LOW STOCK</Badge>
                        ) : isReorder ? (
                          <Badge variant="warning">REORDER</Badge>
                        ) : (
                          <Badge variant="success">OPTIMAL</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Raw Ingredient">
        <form onSubmit={handleAddIngredient} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Ingredient Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Basmati Rice, Boneless Chicken, Olive Oil"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Base Inventory Unit *</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              >
                <option value="KG">Kilograms (KG)</option>
                <option value="G">Grams (G)</option>
                <option value="L">Liters (L)</option>
                <option value="ML">Milliliters (ML)</option>
                <option value="PCS">Pieces (PCS)</option>
                <option value="DOZEN">Dozen</option>
                <option value="PORTION">Portion</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cost Per Unit (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={costPerUnit}
                onChange={(e) => setCostPerUnit(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Minimum Stock (Alert) *</label>
              <input
                type="number"
                step="0.1"
                required
                value={minimumStock}
                onChange={(e) => setMinimumStock(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reorder Level *</label>
              <input
                type="number"
                step="0.1"
                required
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Preferred Supplier</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            >
              <option value="">None / Open Market</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
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
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Ingredient'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
