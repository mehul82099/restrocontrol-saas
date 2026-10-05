'use client';

import React, { useState, useEffect } from 'react';
import { useOutlet } from './layout';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Percent,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Sparkles,
  Calendar,
  RefreshCw,
  Plus,
  Scale,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';

export default function DashboardPage() {
  const { activeOutletId, user } = useOutlet();
  const [filter, setFilter] = useState('today');
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    if (!activeOutletId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/dashboard?outletId=${activeOutletId}&filter=${filter}`);
      const data = await res.json();
      if (data.success) {
        setMetrics(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [activeOutletId, filter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Executive Operations Dashboard
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Live sales, recipe consumption, actual inventory usage, and variance breakdown.
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm self-start sm:self-auto">
          {['today', 'yesterday', '7days', '30days'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                filter === f
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {f === '7days' ? '7 Days' : f === '30days' ? '30 Days' : f}
            </button>
          ))}
          <button
            onClick={fetchMetrics}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-50 ml-1"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Core KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Gross Sales</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              ₹
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {formatCurrency(metrics?.summary?.totalSales || 0)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {metrics?.summary?.ordersCount || 0} finalized orders
          </span>
        </div>

        {/* Average Order Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Average Order</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {formatCurrency(metrics?.summary?.averageOrderValue || 0)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">per customer ticket</span>
        </div>

        {/* Food Cost % */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Food Cost %</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {metrics?.summary?.overallFoodCostPercent || 0}%
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
            Healthy benchmark (28-35%)
          </span>
        </div>

        {/* Gross Contribution */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Gross Margin</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {formatCurrency(metrics?.summary?.overallGrossContribution || 0)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Net menu profit margin</span>
        </div>

        {/* Wastage */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Recorded Wastage</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600">
            {formatCurrency(metrics?.summary?.totalWastageCost || 0)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Loss value in period</span>
        </div>
      </div>

      {/* CORE PROMISE HIGHLIGHT: Inventory Variance Widget */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Core Value Guarantee</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">
              Expected vs. Actual Consumption Reconciliation
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              RestroControl automatically compares the theoretical recipe ingredients consumed from POS sales against real inventory movements to instantly uncover portion variations and stock discrepancies.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60 backdrop-blur-sm">
            <div className="text-center px-4 border-r border-slate-700">
              <span className="text-3xl font-black text-white">
                {metrics?.varianceSummary?.totalTracked || 0}
              </span>
              <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider mt-1">
                Ingredients Tracked
              </span>
            </div>
            <div className="text-center px-4">
              <span className="text-3xl font-black text-amber-400">
                {metrics?.varianceSummary?.highVarianceCount || 0}
              </span>
              <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider mt-1">
                High Variance
              </span>
            </div>
            <Link
              href="/variance"
              className="ml-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              <span>View Variance</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Middle Grid: Low Stock Alert & Top Selling Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alert Widget */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-900 text-sm">Low-Stock Ingredients</h3>
              </div>
              <Link href="/inventory" className="text-xs text-emerald-600 hover:text-emerald-700 font-bold">
                View All Stock →
              </Link>
            </div>

            <div className="divide-y divide-slate-100 mt-2">
              {!metrics?.lowStockItems || metrics.lowStockItems.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  All ingredients are currently above safe minimum levels.
                </div>
              ) : (
                metrics.lowStockItems.map((item: any) => (
                  <div key={item.id} className="py-3 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 text-xs">{item.ingredientName}</span>
                      <span className="text-[11px] text-slate-400 block">
                        Min threshold: {item.minimumStock} {item.unit}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-800">
                        {item.currentStock} {item.unit}
                      </span>
                      <Badge variant={item.isZero ? 'critical' : 'low_stock'}>
                        {item.isZero ? 'OUT OF STOCK' : 'LOW STOCK'}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4">
            <Link
              href="/purchases"
              className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Purchase Order</span>
            </Link>
          </div>
        </div>

        {/* Top Selling Items */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <h3 className="font-bold text-slate-900 text-sm">Top-Selling Dishes</h3>
            </div>
            <Link href="/reports?type=item_sales" className="text-xs text-emerald-600 hover:text-emerald-700 font-bold">
              Sales Report →
            </Link>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {!metrics?.topSellingItems || metrics.topSellingItems.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No orders recorded for this period yet.
              </div>
            ) : (
              metrics.topSellingItems.map((item: any, idx: number) => (
                <div key={item.name} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-slate-800 text-xs">{item.name}</span>
                      <span className="text-[11px] text-slate-400 block">{item.quantity} sold</span>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-slate-900">
                    {formatCurrency(item.revenue)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Low-Margin Items & Recent Purchases */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low-Margin Food Cost Attention */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Recipe Margin Watchlist</h3>
              <p className="text-[11px] text-slate-400">Items with highest food cost percentage</p>
            </div>
            <Link href="/recipes" className="text-xs text-emerald-600 hover:text-emerald-700 font-bold">
              Manage Recipes →
            </Link>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {!metrics?.lowMarginItems || metrics.lowMarginItems.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No recipes configured yet.
              </div>
            ) : (
              metrics.lowMarginItems.map((item: any) => (
                <div key={item.id} className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 text-xs">{item.name}</span>
                    <span className="text-[11px] text-slate-400 block">
                      Price: {formatCurrency(item.sellingPrice)} | Recipe Cost: {formatCurrency(item.recipeCost)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      {item.foodCostPercentage}%
                    </span>
                    <Badge variant={item.foodCostPercentage > 35 ? 'warning' : 'normal'}>
                      {item.marginStatus}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Purchases */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Recent Purchase Orders</h3>
              <p className="text-[11px] text-slate-400">Inventory replenishment from suppliers</p>
            </div>
            <Link href="/purchases" className="text-xs text-emerald-600 hover:text-emerald-700 font-bold">
              View POs →
            </Link>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {!metrics?.recentPurchases || metrics.recentPurchases.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No purchase orders created yet.
              </div>
            ) : (
              metrics.recentPurchases.map((po: any) => (
                <div key={po.id} className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 text-xs">{po.poNumber}</span>
                    <span className="text-[11px] text-slate-400 block">{po.supplierName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-900">
                      {formatCurrency(po.totalAmount)}
                    </span>
                    <Badge variant={po.status === 'RECEIVED' ? 'approved' : 'pending'}>
                      {po.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
