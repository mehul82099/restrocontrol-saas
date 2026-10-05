'use client';

import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  Filter,
  Eye,
  XCircle,
  RotateCcw,
  UtensilsCrossed,
  ShoppingBag,
  Truck,
  CreditCard,
  DollarSign,
  User,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency, formatDate } from '@/lib/utils';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  variantName?: string;
}

interface Payment {
  id: string;
  amount: number;
  paymentMethod: string;
  status: string;
}

interface Order {
  id: string;
  orderNumber: string;
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'SERVED' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';
  cancellationReason?: string;
  refundReason?: string;
  createdAt: string;
  table?: { tableNumber: string };
  customer?: { name: string; phone: string };
  cashier?: { name: string };
  items: OrderItem[];
  payments: Payment[];
  kitchenOrder?: { status: string; ticketNumber: string };
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Modals
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancelOrderModal, setCancelOrderModal] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('Customer Request');
  const [reverseStock, setReverseStock] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const [refundOrderModal, setRefundOrderModal] = useState<Order | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('Quality dissatisfaction');
  const [refunding, setRefunding] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/orders');
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.error('Failed to load orders', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelOrderModal) return;

    try {
      setCancelling(true);
      const res = await fetch(`/api/orders/${cancelOrderModal.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: cancelReason,
          reverseStock,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to cancel order');

      setCancelOrderModal(null);
      await fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Error cancelling order');
    } finally {
      setCancelling(false);
    }
  };

  const handleRefundOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundOrderModal) return;

    try {
      setRefunding(true);
      const res = await fetch(`/api/orders/${refundOrderModal.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: refundAmount,
          reason: refundReason,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to refund order');

      setRefundOrderModal(null);
      await fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Error refunding order');
    } finally {
      setRefunding(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || o.orderType === typeFilter;
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
      o.table?.tableNumber?.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesType && matchesSearch;
  });

  const totalSales = orders
    .filter((o) => o.status === 'COMPLETED' || o.status === 'CONFIRMED' || o.status === 'SERVED')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const completedCount = orders.filter(
    (o) => o.status === 'COMPLETED' || o.status === 'SERVED' || o.status === 'CONFIRMED'
  ).length;

  const aov = completedCount > 0 ? totalSales / completedCount : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-7 h-7 text-emerald-600" />
            Orders & Bill History
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse guest tickets, audit transactional receipts, issue cancellations or manage refunds
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross Sales</span>
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{formatCurrency(totalSales)}</span>
            <span className="text-xs text-slate-500">revenue</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Bills</span>
            <Receipt className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{orders.length}</span>
            <span className="text-xs text-slate-500">processed</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average Order Value</span>
            <CreditCard className="w-5 h-5 text-amber-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{formatCurrency(aov)}</span>
            <span className="text-xs text-slate-500">per ticket</span>
          </div>
        </div>
      </div>

      {/* Table & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full lg:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by order #, customer, table..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-2 self-start lg:self-auto overflow-x-auto w-full lg:w-auto pb-1">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
            >
              <option value="ALL">All Types</option>
              <option value="DINE_IN">Dine In</option>
              <option value="TAKEAWAY">Takeaway</option>
              <option value="DELIVERY">Delivery</option>
            </select>

            {['ALL', 'COMPLETED', 'CONFIRMED', 'CANCELLED', 'REFUNDED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  statusFilter === st ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Receipt className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">No orders match filter criteria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Order Code</th>
                  <th className="py-3 px-4">Type / Table</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredOrders.map((ord) => {
                  const paymentMethod = ord.payments?.[0]?.paymentMethod || 'CASH';
                  return (
                    <tr key={ord.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{ord.orderNumber}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          {ord.orderType === 'DINE_IN' ? (
                            <UtensilsCrossed className="w-3.5 h-3.5 text-indigo-600" />
                          ) : ord.orderType === 'TAKEAWAY' ? (
                            <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
                          ) : (
                            <Truck className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                          <span>
                            {ord.orderType.replace('_', ' ')}
                            {ord.table ? ` (T${ord.table.tableNumber})` : ''}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 font-mono">{formatDate(ord.createdAt)}</td>
                      <td className="py-3 px-4 text-slate-700 text-xs">
                        {ord.customer ? (
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{ord.customer.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">Walk-in</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-800">
                        {ord.items?.length || 0}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(ord.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-slate-600">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-mono">
                          {paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {ord.status === 'COMPLETED' ? (
                          <Badge variant="success">COMPLETED</Badge>
                        ) : ord.status === 'CANCELLED' ? (
                          <Badge variant="danger">CANCELLED</Badge>
                        ) : ord.status === 'REFUNDED' ? (
                          <Badge variant="warning">REFUNDED</Badge>
                        ) : (
                          <Badge variant="neutral">{ord.status}</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedOrder(ord)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs"
                            title="View Receipt Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {ord.status !== 'CANCELLED' && ord.status !== 'REFUNDED' && (
                            <>
                              <button
                                onClick={() => setCancelOrderModal(ord)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-xs"
                                title="Cancel Order & Restock"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setRefundOrderModal(ord);
                                  setRefundAmount(ord.totalAmount.toString());
                                }}
                                className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg text-xs"
                                title="Issue Refund"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Receipt Modal */}
      {selectedOrder && (
        <Modal
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          title={`Order Receipt: ${selectedOrder.orderNumber}`}
        >
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px] block">Order Type</span>
                <span className="font-semibold text-slate-800">
                  {selectedOrder.orderType.replace('_', ' ')}
                  {selectedOrder.table ? ` — Table ${selectedOrder.table.tableNumber}` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px] block">Status</span>
                <span className="font-bold text-emerald-600">{selectedOrder.status}</span>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px] block">Date</span>
                <span className="font-mono text-slate-700">{formatDate(selectedOrder.createdAt)}</span>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px] block">Billed By</span>
                <span className="font-medium text-slate-700">{selectedOrder.cashier?.name || 'Staff'}</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase">
                  <tr>
                    <th className="py-2 px-3">Item</th>
                    <th className="py-2 px-3 text-center">Qty</th>
                    <th className="py-2 px-3 text-right">Unit Price</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedOrder.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-800">{item.name}</div>
                        {item.variantName && (
                          <span className="text-[10px] text-slate-400">{item.variantName}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-slate-900">{item.quantity}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(item.totalPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono">{formatCurrency(selectedOrder.subtotal)}</span>
              </div>
              {selectedOrder.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span className="font-mono">-{formatCurrency(selectedOrder.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Tax (GST)</span>
                <span className="font-mono">+{formatCurrency(selectedOrder.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
                <span>Total Amount</span>
                <span className="font-mono text-emerald-600">{formatCurrency(selectedOrder.totalAmount)}</span>
              </div>
            </div>

            {selectedOrder.cancellationReason && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
                <span className="font-bold">Cancellation Reason: </span>
                {selectedOrder.cancellationReason}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Cancel Modal */}
      {cancelOrderModal && (
        <Modal
          isOpen={!!cancelOrderModal}
          onClose={() => setCancelOrderModal(null)}
          title={`Cancel Order: ${cancelOrderModal.orderNumber}`}
        >
          <form onSubmit={handleCancelOrder} className="space-y-4">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900">
              Cancelling this order will void the transaction. If raw ingredients were already consumed, you can reverse
              the consumption back into stock.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Cancellation *</label>
              <input
                type="text"
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Guest left before preparation, billing mistake"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="reverseStock"
                checked={reverseStock}
                onChange={(e) => setReverseStock(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="reverseStock" className="text-xs font-semibold text-slate-700 cursor-pointer">
                Reverse raw ingredient deduction (Restock in Ledger)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCancelOrderModal(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Dismiss
              </button>
              <button
                type="submit"
                disabled={cancelling}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl shadow-xs disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Void / Cancel'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Refund Modal */}
      {refundOrderModal && (
        <Modal
          isOpen={!!refundOrderModal}
          onClose={() => setRefundOrderModal(null)}
          title={`Issue Refund: ${refundOrderModal.orderNumber}`}
        >
          <form onSubmit={handleRefundOrder} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Refund Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                max={refundOrderModal.totalAmount}
                required
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Refund Reason *</label>
              <input
                type="text"
                required
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="e.g. Dish cold, delayed service"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRefundOrderModal(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Dismiss
              </button>
              <button
                type="submit"
                disabled={refunding}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl shadow-xs disabled:opacity-50"
              >
                {refunding ? 'Refunding...' : 'Confirm Refund'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
