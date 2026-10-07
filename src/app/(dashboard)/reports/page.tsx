'use client';
import { useOutlet } from '../layout';
import { apiFetch } from '@/lib/api-fetch';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Search,
  Filter,
  Receipt,
  Boxes,
  DollarSign,
  TrendingDown,
  PieChart,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface ReportCategory {
  title: string;
  reports: { id: string; name: string; description: string }[];
}

const REPORT_CATEGORIES: ReportCategory[] = [
  {
    title: 'SALES & REVENUE',
    reports: [
      { id: 'sales', name: 'Sales Summary', description: 'Overall revenue, orders count, and net billing' },
      { id: 'item_sales', name: 'Item Sales', description: 'Quantity sold and revenue generated per menu item' },
      { id: 'category_sales', name: 'Category Sales', description: 'Revenue share and order distribution by category' },
      { id: 'payment', name: 'Payment Breakdown', description: 'Collections grouped by Cash, UPI, Card, and Split' },
      { id: 'discount', name: 'Discounts Report', description: 'Discounts given and promotional margins' },
      { id: 'cancellation', name: 'Cancellations & Refunds', description: 'Voided orders and refund reasons' },
    ],
  },
  {
    title: 'INVENTORY & CONSUMPTION',
    reports: [
      { id: 'current_stock', name: 'Current Stock', description: 'Live physical inventory balance and valuation' },
      { id: 'stock_movement', name: 'Stock Movement Ledger', description: 'Complete chronological audit of all stock in/out' },
      { id: 'consumption', name: 'Recipe Consumption', description: 'Expected vs recorded ingredient usage' },
      { id: 'wastage', name: 'Kitchen Wastage', description: 'Spoilage, expired, and burnt ingredient losses' },
      { id: 'stock_adjustments', name: 'Stock Adjustments', description: 'Manual adjustments and shrinkage reconciliations' },
      { id: 'low_stock', name: 'Low Stock Alert', description: 'Ingredients at or below safety reorder levels' },
      { id: 'physical_stock', name: 'Physical Stock Audits', description: 'History and variance of physical counts' },
    ],
  },
  {
    title: 'COSTING & PROCUREMENTS',
    reports: [
      { id: 'purchases', name: 'Purchases & Inbound', description: 'All POs, vendor receipts, and restock spend' },
      { id: 'supplier', name: 'Supplier Procurement', description: 'Spend breakdown grouped by vendor' },
      { id: 'purchase_price_history', name: 'Price Fluctuation History', description: 'Historical unit price trends per ingredient' },
      { id: 'recipe_costing', name: 'Recipe Cost Breakdown', description: 'Bill of materials costing per dish' },
      { id: 'food_cost', name: 'Food Cost % Analysis', description: 'Cost of goods sold (COGS) vs selling price' },
      { id: 'item_margin', name: 'Item Gross Margins', description: 'Contribution margin and high/low profit items' },
      { id: 'inventory_variance', name: 'Inventory Variance Engine', description: 'Expected vs actual ingredient variance' },
    ],
  },
];

export default function ReportsPage() {
  const { activeOutletId } = useOutlet();
  const [selectedReport, setSelectedReport] = useState('sales');
  const [dateFilter, setDateFilter] = useState('7days');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<{
    title: string;
    headers: string[];
    rows: any[][];
    summary?: any;
  } | null>(null);
  const [search, setSearch] = useState('');

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(activeOutletId, `/api/reports?type=${selectedReport}&filter=${dateFilter}&format=json`);
      const data = await res.json();
      if (data.success) {
        setReportData({...data, rows: data.rows.map((row: any) => data.headers.map((header: string) => row[header]))});
      }
    } catch (err) {
      console.error('Failed to load report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedReport, dateFilter, activeOutletId]);

  const handleExportCSV = () => {
    window.location.href = `/api/reports?type=${selectedReport}&filter=${dateFilter}&outletId=${activeOutletId}&format=csv`;
  };

  const filteredRows = (reportData?.rows || []).filter((row) =>
    row.some((cell) => String(cell).toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-emerald-600" />
            Business & Inventory Reports
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Exportable operational metrics, inventory reconciliations, food costing, and audit summaries
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Date Filter Buttons */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7days', label: '7 Days' },
              { id: '30days', label: '30 Days' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  dateFilter === f.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar: 20 Reports Menu */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
            {REPORT_CATEGORIES.map((cat) => (
              <div key={cat.title} className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block">
                  {cat.title}
                </span>
                <div className="space-y-0.5">
                  {cat.reports.map((rep) => (
                    <button
                      key={rep.id}
                      onClick={() => setSelectedReport(rep.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex flex-col ${
                        selectedReport === rep.id
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{rep.name}</span>
                      <span
                        className={`text-[10px] font-normal truncate ${
                          selectedReport === rep.id ? 'text-emerald-100' : 'text-slate-400'
                        }`}
                      >
                        {rep.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Area: Report View Table */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {/* Header info */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{reportData?.title || 'Report View'}</h3>
                <p className="text-xs text-slate-400">
                  Showing records for: <strong className="text-slate-700 uppercase">{dateFilter}</strong>
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search in table..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {loading ? (
              <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                <span>Computing report datasets...</span>
              </div>
            ) : !reportData || reportData.headers.length === 0 ? (
              <div className="p-16 text-center text-slate-400">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700">No data available for this range</p>
                <p className="text-xs text-slate-400 mt-1">Try expanding your date filter or create POS orders.</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      {reportData.headers.map((h, i) => (
                        <th key={i} className="py-2.5 px-3">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={reportData.headers.length} className="p-8 text-center text-slate-400">
                          No matching records found
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50/60 transition-colors">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="py-2.5 px-3 text-slate-800">
                              {typeof cell === 'number' && (cell > 100 || cell % 1 !== 0) ? (
                                <span className="font-mono">{cell}</span>
                              ) : (
                                cell
                              )}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer Summary / Count */}
            {reportData && (
              <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Total records: {filteredRows.length}</span>
                <span className="font-medium text-emerald-700">CSV Export Ready</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
