'use client';
import { useOutlet } from '../layout';
import { apiFetch } from '@/lib/api-fetch';

import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Plus,
  Search,
  PackageCheck,
  Building2,
  Calendar,
  DollarSign,
  Truck,
  CheckCircle2,
  Eye,
  Trash2,
  Phone,
  Mail,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency, formatDate } from '@/lib/utils';

interface POItem {
  ingredientId: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalAmount: number;
  ingredient: { name: string; unit: string };
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
  totalAmount: number;
  createdAt: string;
  expectedDate?: string;
  notes?: string;
  supplier: { id: string; name: string; phone?: string };
  items: POItem[];
}

interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentTerms?: string;
  _count?: { purchaseOrders: number };
}

interface IngredientOption {
  id: string;
  name: string;
  unit: string;
  costPerUnit: number;
}

export default function PurchasesPage() {
  const { activeOutletId } = useOutlet();
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'SUPPLIERS'>('ORDERS');
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredients, setIngredients] = useState<IngredientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  // New PO Modal
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [poSupplierId, setPOSupplierId] = useState('');
  const [poNotes, setPONotes] = useState('');
  const [poItems, setPOItems] = useState<{ ingredientId: string; quantity: string; unitPrice: string }[]>([]);
  const [savingPO, setSavingPO] = useState(false);

  // Receive Goods Modal
  const [receiveModalPO, setReceiveModalPO] = useState<PurchaseOrder | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [receiveNotes, setReceiveNotes] = useState('');
  const [receiving, setReceiving] = useState(false);

  // New Supplier Modal
  const [isSupModalOpen, setIsSupModalOpen] = useState(false);
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [savingSup, setSavingSup] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ordRes, supRes, ingRes] = await Promise.all([
        apiFetch(activeOutletId, '/api/purchases/orders').then((r) => r.json()),
        apiFetch(activeOutletId, '/api/purchases/suppliers').then((r) => r.json()),
        apiFetch(activeOutletId, '/api/ingredients').then((r) => r.json()),
      ]);

      if (ordRes.orders) setOrders(ordRes.orders);
      if (supRes.suppliers) setSuppliers(supRes.suppliers);
      if (ingRes.ingredients) setIngredients(ingRes.ingredients);
    } catch (err) {
      console.error('Failed to load purchases', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeOutletId]);

  const openNewPOModal = () => {
    setPOSupplierId(suppliers[0]?.id || '');
    setPONotes('');
    setPOItems([
      {
        ingredientId: ingredients[0]?.id || '',
        quantity: '10',
        unitPrice: (ingredients[0]?.costPerUnit || 100).toString(),
      },
    ]);
    setIsPOModalOpen(true);
  };

  const handlePOItemChange = (index: number, field: string, val: string) => {
    const updated = [...poItems];
    updated[index] = { ...updated[index], [field]: val };

    if (field === 'ingredientId') {
      const ing = ingredients.find((i) => i.id === val);
      if (ing) updated[index].unitPrice = ing.costPerUnit.toString();
    }
    setPOItems(updated);
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingPO(true);
      const itemsPayload = poItems.map((item) => {
        const ing = ingredients.find((i) => i.id === item.ingredientId);
        return {
          ingredientId: item.ingredientId,
          quantity: parseFloat(item.quantity) || 1,
          unit: ing?.unit || 'KG',
          unitPrice: parseFloat(item.unitPrice) || 0,
        };
      });

      const res = await apiFetch(activeOutletId, '/api/purchases/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: poSupplierId,
          items: itemsPayload,
          notes: poNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create PO');

      setIsPOModalOpen(false);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Error creating purchase order');
    } finally {
      setSavingPO(false);
    }
  };

  const handleReceiveGoods = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveModalPO) return;

    try {
      setReceiving(true);
      const res = await apiFetch(activeOutletId, '/api/purchases/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseOrderId: receiveModalPO.id,
          invoiceNumber,
          notes: receiveNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to receive goods');

      setReceiveModalPO(null);
      setInvoiceNumber('');
      setReceiveNotes('');
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Error receiving shipment');
    } finally {
      setReceiving(false);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSup(true);
      const res = await apiFetch(activeOutletId, '/api/purchases/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: supName,
          contactPerson: supContact,
          phone: supPhone,
          email: supEmail,
          address: supAddress,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create supplier');

      setIsSupModalOpen(false);
      setSupName('');
      setSupContact('');
      setSupPhone('');
      setSupEmail('');
      setSupAddress('');
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Error creating supplier');
    } finally {
      setSavingSup(false);
    }
  };

  const totalSpent = orders
    .filter((o) => o.status === 'RECEIVED')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const pendingReceiveCount = orders.filter((o) => o.status === 'ORDERED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-7 h-7 text-emerald-600" />
            Purchases, Inbound Goods & Suppliers
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Generate POs, receive stock shipments to replenish raw inventory, and track historical purchase pricing
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsSupModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-all"
          >
            <Building2 className="w-4 h-4 text-slate-600" />
            Add Supplier
          </button>
          <button
            onClick={openNewPOModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Purchase Order
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Received Goods</span>
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{formatCurrency(totalSpent)}</span>
            <span className="text-xs text-slate-500">inventory added</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">In-Transit Shipments</span>
            <Truck className="w-5 h-5 text-amber-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-600">{pendingReceiveCount}</span>
            <span className="text-xs text-slate-500">awaiting receiving</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Suppliers</span>
            <Building2 className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{suppliers.length}</span>
            <span className="text-xs text-slate-500">vendors</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('ORDERS')}
          className={`px-4 py-2 font-bold text-sm rounded-xl transition-all ${
            activeTab === 'ORDERS' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Purchase Orders ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('SUPPLIERS')}
          className={`px-4 py-2 font-bold text-sm rounded-xl transition-all ${
            activeTab === 'SUPPLIERS' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Suppliers & Vendors ({suppliers.length})
        </button>
      </div>

      {/* Orders Tab Content */}
      {activeTab === 'ORDERS' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400">Loading purchase orders...</div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <ShoppingBag className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-base font-semibold text-slate-700">No purchase orders found</p>
              <p className="text-sm text-slate-500 mt-1">Create your first PO to restock inventory.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">PO Code</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Order Date</th>
                    <th className="py-3 px-4 text-center">Items</th>
                    <th className="py-3 px-4 text-right">Total Amount</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {orders.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{po.poNumber}</td>
                      <td className="py-3 px-4 font-medium text-slate-900 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        {po.supplier.name}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 font-mono">{formatDate(po.createdAt)}</td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-800">
                        {po.items?.length || 0}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(po.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {po.status === 'RECEIVED' ? (
                          <Badge variant="success">RECEIVED</Badge>
                        ) : po.status === 'ORDERED' ? (
                          <Badge variant="warning">ORDERED</Badge>
                        ) : po.status === 'DRAFT' ? (
                          <Badge variant="neutral">DRAFT</Badge>
                        ) : (
                          <Badge variant="danger">CANCELLED</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedPO(po)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                          {po.status === 'ORDERED' && (
                            <button
                              onClick={() => {
                                setReceiveModalPO(po);
                                setInvoiceNumber(`INV-${po.poNumber.replace('PO-', '')}`);
                              }}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                            >
                              <PackageCheck className="w-3.5 h-3.5" /> Receive Goods
                            </button>
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
      )}

      {/* Suppliers Tab Content */}
      {activeTab === 'SUPPLIERS' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Supplier Name</th>
                  <th className="py-3 px-4">Contact Person</th>
                  <th className="py-3 px-4">Contact Details</th>
                  <th className="py-3 px-4">Address</th>
                  <th className="py-3 px-4 text-center">Orders Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {suppliers.map((sup) => (
                  <tr key={sup.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-bold text-slate-900">{sup.name}</td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{sup.contactPerson || '—'}</td>
                    <td className="py-3 px-4 text-xs text-slate-600 space-y-0.5">
                      {sup.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{sup.phone}</span>
                        </div>
                      )}
                      {sup.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{sup.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">{sup.address || '—'}</td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">
                      {sup._count?.purchaseOrders || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create PO Modal */}
      <Modal isOpen={isPOModalOpen} onClose={() => setIsPOModalOpen(false)} title="Create Purchase Order" maxWidth="lg">
        <form onSubmit={handleCreatePO} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Supplier *</label>
            <select
              value={poSupplierId}
              onChange={(e) => setPOSupplierId(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase">Order Items</span>
              <button
                type="button"
                onClick={() =>
                  setPOItems([
                    ...poItems,
                    {
                      ingredientId: ingredients[0]?.id || '',
                      quantity: '10',
                      unitPrice: (ingredients[0]?.costPerUnit || 100).toString(),
                    },
                  ])
                }
                className="text-xs text-emerald-600 font-bold hover:underline"
              >
                + Add Item
              </button>
            </div>

            {poItems.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <select
                  value={item.ingredientId}
                  onChange={(e) => handlePOItemChange(idx, 'ingredientId', e.target.value)}
                  className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                >
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unit})
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  step="0.1"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => handlePOItemChange(idx, 'quantity', e.target.value)}
                  className="w-24 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-right font-mono"
                />

                <input
                  type="number"
                  step="0.01"
                  placeholder="Price"
                  value={item.unitPrice}
                  onChange={(e) => handlePOItemChange(idx, 'unitPrice', e.target.value)}
                  className="w-24 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-right font-mono"
                />

                {poItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPOItems(poItems.filter((_, i) => i !== idx))}
                    className="p-1 text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Instructions</label>
            <textarea
              rows={2}
              value={poNotes}
              onChange={(e) => setPONotes(e.target.value)}
              placeholder="e.g. Deliver before 10 AM, check temperature"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsPOModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingPO}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs disabled:opacity-50"
            >
              {savingPO ? 'Sending PO...' : 'Issue Purchase Order'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Receive Goods Modal */}
      {receiveModalPO && (
        <Modal
          isOpen={!!receiveModalPO}
          onClose={() => setReceiveModalPO(null)}
          title={`Receive Goods: ${receiveModalPO.poNumber}`}
        >
          <form onSubmit={handleReceiveGoods} className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs text-emerald-900">
              Receiving this shipment will automatically add the ordered quantities into raw inventory stock via an
              immutable <strong>PURCHASE</strong> ledger entry and record historical pricing.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor Invoice # *</label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Receiving Notes</label>
              <input
                type="text"
                value={receiveNotes}
                onChange={(e) => setReceiveNotes(e.target.value)}
                placeholder="e.g. Inspected and verified packaging condition"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReceiveModalPO(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={receiving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs disabled:opacity-50"
              >
                {receiving ? 'Updating Stock...' : 'Confirm Inbound Goods'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Supplier Modal */}
      <Modal isOpen={isSupModalOpen} onClose={() => setIsSupModalOpen(false)} title="Register Supplier / Vendor">
        <form onSubmit={handleCreateSupplier} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Company Name *</label>
            <input
              type="text"
              required
              value={supName}
              onChange={(e) => setSupName(e.target.value)}
              placeholder="e.g. Fresh Meat Wholesale Pvt Ltd"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
              <input
                type="text"
                value={supContact}
                onChange={(e) => setSupContact(e.target.value)}
                placeholder="e.g. Rajesh Kumar"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
              <input
                type="tel"
                value={supPhone}
                onChange={(e) => setSupPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={supEmail}
              onChange={(e) => setSupEmail(e.target.value)}
              placeholder="orders@supplier.com"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
            <input
              type="text"
              value={supAddress}
              onChange={(e) => setSupAddress(e.target.value)}
              placeholder="Wholesale Market, Sector 4"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsSupModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingSup}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs disabled:opacity-50"
            >
              {savingSup ? 'Saving...' : 'Save Vendor'}
            </button>
          </div>
        </form>
      </Modal>

      {/* PO View Modal */}
      {selectedPO && (
        <Modal isOpen={!!selectedPO} onClose={() => setSelectedPO(null)} title={`PO: ${selectedPO.poNumber}`} maxWidth="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px]">Supplier</span>
                <p className="font-semibold text-slate-800">{selectedPO.supplier.name}</p>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px]">Date Issued</span>
                <p className="font-semibold text-slate-800">{formatDate(selectedPO.createdAt)}</p>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px]">Total Amount</span>
                <p className="font-bold text-emerald-600">{formatCurrency(selectedPO.totalAmount)}</p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Item</th>
                    <th className="py-2.5 px-3 text-right">Quantity</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedPO.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{item.ingredient.name}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                        {formatCurrency(item.totalAmount)}
                      </td>
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
