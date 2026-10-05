'use client';

import React, { useState, useEffect } from 'react';
import { useOutlet } from '../layout';
import {
  Sparkles,
  Download,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  Info,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

export default function VariancePage() {
  const { activeOutletId } = useOutlet();
  const [filter, setFilter] = useState('today');
  const [varianceData, setVarianceData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchVariance = async () => {
    if (!activeOutletId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/variance?outletId=${activeOutletId}&filter=${filter}`);
      const data = await res.json();
      if (data.success) {
        setVarianceData(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVariance();
  }, [activeOutletId, filter]);

  const handleExportCSV = () => {
    window.open(`/api/reports?type=inventory_variance&outletId=${activeOutletId}&filter=${filter}&format=csv`, '_blank');
  };

  const totalVarianceCost =
    varianceData?.items?.reduce((sum: number, item: any) => sum + (item.varianceCost || 0), 0) || 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Expected vs. Actual Consumption
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
              Core Analytics
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            &ldquo;Know what your restaurant sold, what recipes should have consumed, and what actually left inventory.&rdquo;
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Date Filter */}
          <div className="flex items-center p-1 bg-white border border-slate-200 rounded-2xl shadow-sm text-xs">
            {['today', 'yesterday', '7days', '30days'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-xl font-bold capitalize transition-all ${
                  filter === f
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f === '7days' ? '7 Days' : f === '30days' ? '30 Days' : f}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Ingredients Tracked</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            {varianceData?.totalIngredientsTracked || 0}
          </span>
          <span className="text-[11px] text-slate-500">with recipe or stock activity</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">High Variance Items</span>
          <span className="text-2xl font-black text-amber-500 mt-1 block">
            {varianceData?.highVarianceCount || 0}
          </span>
          <span className="text-[11px] text-amber-700 font-medium">&gt;15% variance threshold</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Net Financial Variance</span>
          <span
            className={`text-2xl font-black mt-1 block ${
              totalVarianceCost > 0 ? 'text-rose-600' : 'text-emerald-600'
            }`}
          >
            {formatCurrency(totalVarianceCost)}
          </span>
          <span className="text-[11px] text-slate-500">
            {totalVarianceCost > 0 ? 'Excess consumption cost' : 'Stock conserved'}
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Calculation Policy</span>
          <span className="text-sm font-bold text-slate-800 mt-2 block">
            Multi-factor Root Cause
          </span>
          <span className="text-[11px] text-slate-400">Zero default theft accusations</span>
        </div>
      </div>

      {/* Explanations Guide Card */}
      <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3 text-xs text-indigo-950">
        <Info className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Understanding Variance Explanations:</span>
          <p className="text-indigo-800 text-[11px] mt-0.5">
            Variance represents the delta between theoretical consumption (POS sold quantity × recipe specification) and actual inventory ledger movements. RestroControl tags potential operational causes such as recorded kitchen wastage, portion variances, unrecorded prep snacks, or physical stock adjustments.
          </p>
        </div>
      </div>

      {/* Main Variance Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Ingredient</th>
                <th className="px-4 py-4 text-right">Expected (Recipe)</th>
                <th className="px-4 py-4 text-right">Actual Consumed</th>
                <th className="px-4 py-4 text-right">Breakdown (Sales / Waste / Adj)</th>
                <th className="px-4 py-4 text-right">Variance Qty</th>
                <th className="px-4 py-4 text-right">Variance %</th>
                <th className="px-4 py-4 text-right">Cost Impact</th>
                <th className="px-6 py-4">Operational Explanations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Calculating variance matrix...
                  </td>
                </tr>
              ) : !varianceData?.items || varianceData.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    No consumption or recipe movements found in this period. Place orders in POS to view live calculations.
                  </td>
                </tr>
              ) : (
                varianceData.items.map((row: any) => {
                  const isHigh = row.status === 'HIGH_VARIANCE';
                  const isPositive = row.variance > 0;

                  return (
                    <tr key={row.ingredientId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-extrabold text-slate-900 text-sm">{row.ingredientName}</span>
                        <span className="text-[11px] text-slate-400 block">Unit: {row.unit}</span>
                      </td>

                      <td className="px-4 py-4 text-right font-bold text-slate-700">
                        {row.expected} {row.unit}
                      </td>

                      <td className="px-4 py-4 text-right font-black text-slate-900">
                        {row.actual} {row.unit}
                      </td>

                      <td className="px-4 py-4 text-right text-[11px] text-slate-500 font-medium">
                        <div>Sales: {row.salesDeduction} {row.unit}</div>
                        {row.wastage > 0 && <div className="text-rose-600">Waste: {row.wastage} {row.unit}</div>}
                        {row.adjustments !== 0 && <div className="text-amber-600">Adj: {row.adjustments} {row.unit}</div>}
                      </td>

                      <td
                        className={`px-4 py-4 text-right font-black ${
                          row.variance === 0
                            ? 'text-slate-500'
                            : isPositive
                            ? 'text-rose-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {isPositive ? `+${row.variance}` : row.variance} {row.unit}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <Badge
                          variant={
                            row.variance === 0
                              ? 'normal'
                              : isHigh
                              ? 'critical'
                              : 'warning'
                          }
                        >
                          {row.variancePercent > 0 ? `+${row.variancePercent}%` : `${row.variancePercent}%`}
                        </Badge>
                      </td>

                      <td className="px-4 py-4 text-right font-black text-slate-900">
                        {formatCurrency(row.varianceCost)}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {row.explanations.map((exp: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-md text-[10px] font-medium"
                            >
                              {exp}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
