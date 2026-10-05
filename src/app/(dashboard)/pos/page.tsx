'use client';

import React, { useState, useEffect } from 'react';
import { useOutlet } from '../layout';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  PauseCircle,
  PlayCircle,
  X,
  CreditCard,
  QrCode,
  Banknote,
  Receipt,
  User,
  Utensils,
  ShoppingBag,
  Truck,
  Check,
  Percent,
  Printer,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';

export default function PosPage() {
  const { activeOutletId, user } = useOutlet();

  // Catalog State
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Active Order State
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'>('DINE_IN');
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [orderNotes, setOrderNotes] = useState('');

  // Held Orders State
  const [heldOrders, setHeldOrders] = useState<any[]>([]);
  const [showHeldModal, setShowHeldModal] = useState(false);

  // Item Customizer Modal (variants & addons)
  const [customizingItem, setCustomizingItem] = useState<any>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [selectedAddons, setSelectedAddons] = useState<any[]>([]);
  const [itemNote, setItemNote] = useState('');

  // Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'SPLIT'>('UPI');
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [splitPayments, setSplitPayments] = useState<{ cash: number; upi: number; card: number }>({ cash: 0, upi: 0, card: 0 });
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Receipt Modal
  const [completedOrder, setCompletedOrder] = useState<any>(null);

  // Fetch POS Catalog
  const fetchCatalog = async () => {
    if (!activeOutletId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pos/catalog?outletId=${activeOutletId}`);
      const data = await res.json();
      if (data.success) {
        setCategories(data.catalog.categories || []);
        setItems(data.catalog.items || []);
        setTables(data.catalog.tables || []);
        setCustomers(data.catalog.customers || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, [activeOutletId]);

  // Cart Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const discountAmount = Math.round(((subtotal * discountPercent) / 100) * 100) / 100;
  const taxable = subtotal - discountAmount;
  const taxAmount = Math.round(taxable * 0.05 * 100) / 100; // 5% GST
  const deliveryFee = orderType === 'DELIVERY' ? 40 : 0;
  const grandTotal = Math.max(0, Math.round((taxable + taxAmount + deliveryFee) * 100) / 100);

  // Handle Item Click: if item has variants or addons, open modal; otherwise add directly
  const handleItemClick = (item: any) => {
    if ((item.variants && item.variants.length > 0) || (item.addons && item.addons.length > 0)) {
      setCustomizingItem(item);
      setSelectedVariant(item.variants?.[0] || null);
      setSelectedAddons([]);
      setItemNote('');
    } else {
      addToCartDirect(item);
    }
  };

  const addToCartDirect = (item: any, variant?: any, addons: any[] = [], note = '') => {
    const unitPrice = variant ? variant.price : item.basePrice;
    const addonsTotal = addons.reduce((sum, a) => sum + a.price, 0);
    const finalUnitPrice = unitPrice + addonsTotal;
    const cartItemId = `${item.id}-${variant?.id || 'base'}-${addons.map((a) => a.id).sort().join(',')}`;

    const existingIdx = cart.findIndex((i) => i.cartItemId === cartItemId);
    if (existingIdx > -1) {
      const updated = [...cart];
      updated[existingIdx].quantity += 1;
      updated[existingIdx].totalPrice = updated[existingIdx].quantity * updated[existingIdx].unitPrice;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          cartItemId,
          menuItemId: item.id,
          variantId: variant?.id || null,
          name: variant ? `${item.name} (${variant.name})` : item.name,
          quantity: 1,
          unitPrice: finalUnitPrice,
          totalPrice: finalUnitPrice,
          notes: note,
          addons,
        },
      ]);
    }
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    const updated = cart
      .map((item) => {
        if (item.cartItemId === cartItemId) {
          const newQty = item.quantity + delta;
          return {
            ...item,
            quantity: newQty,
            totalPrice: newQty * item.unitPrice,
          };
        }
        return item;
      })
      .filter((item) => item.quantity > 0);
    setCart(updated);
  };

  // Hold / Resume Order
  const handleHoldOrder = () => {
    if (cart.length === 0) return;
    const held = {
      id: `HOLD-${Date.now()}`,
      orderType,
      selectedTable,
      selectedCustomer,
      cart,
      discountPercent,
      orderNotes,
      heldAt: new Date(),
    };
    setHeldOrders([...heldOrders, held]);
    // Clear active cart
    setCart([]);
    setSelectedTable(null);
    setSelectedCustomer(null);
    setDiscountPercent(0);
    setOrderNotes('');
  };

  const handleResumeOrder = (held: any) => {
    setOrderType(held.orderType);
    setSelectedTable(held.selectedTable);
    setSelectedCustomer(held.selectedCustomer);
    setCart(held.cart);
    setDiscountPercent(held.discountPercent);
    setOrderNotes(held.orderNotes);
    setHeldOrders(heldOrders.filter((h) => h.id !== held.id));
    setShowHeldModal(false);
  };

  // Checkout Execution
  const handleFinalizeOrder = async () => {
    if (cart.length === 0) return;
    setIsProcessingPayment(true);

    try {
      // Build payment payloads
      const payments = [];
      if (paymentMethod === 'SPLIT') {
        if (splitPayments.cash > 0) payments.push({ amount: splitPayments.cash, paymentMethod: 'CASH' as const });
        if (splitPayments.upi > 0) payments.push({ amount: splitPayments.upi, paymentMethod: 'UPI' as const });
        if (splitPayments.card > 0) payments.push({ amount: splitPayments.card, paymentMethod: 'CARD' as const });
      } else {
        payments.push({
          amount: grandTotal,
          paymentMethod,
          transactionRef: `${paymentMethod}-${Date.now().toString().slice(-6)}`,
        });
      }

      // Generate client idempotency key to prevent double deduction
      const idempotencyKey = `POS-${activeOutletId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const res = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outletId: activeOutletId,
          orderType,
          tableId: selectedTable?.id || null,
          customerId: selectedCustomer?.id || null,
          idempotencyKey,
          items: cart.map((c) => ({
            menuItemId: c.menuItemId,
            variantId: c.variantId,
            name: c.name,
            quantity: c.quantity,
            unitPrice: c.unitPrice,
            totalPrice: c.totalPrice,
            notes: c.notes,
            addons: c.addons,
          })),
          subtotal,
          discountAmount,
          discountReason: discountPercent > 0 ? `${discountPercent}% staff discount` : undefined,
          taxAmount,
          deliveryFee,
          totalAmount: grandTotal,
          notes: orderNotes,
          payments,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Checkout failed');
      }

      // Success: open receipt modal and clear active order
      setCompletedOrder({
        ...data.order,
        items: data.items,
        payments,
        tableName: selectedTable?.tableNumber,
        customerName: selectedCustomer?.name,
        consumption: data.consumption,
      });
      setShowPaymentModal(false);
      setCart([]);
      setSelectedTable(null);
      setSelectedCustomer(null);
      setDiscountPercent(0);
      setOrderNotes('');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.categoryId === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.shortCode && item.shortCode.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-6rem)] max-w-[1600px] mx-auto select-none">
      {/* LEFT: Catalog & Item Grid */}
      <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-5">
        {/* Top Controls: Order Type & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
          {/* Order Type Selector */}
          <div className="flex items-center p-1 bg-slate-100 rounded-2xl">
            <button
              onClick={() => setOrderType('DINE_IN')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                orderType === 'DINE_IN'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Dine-In</span>
            </button>
            <button
              onClick={() => setOrderType('TAKEAWAY')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                orderType === 'TAKEAWAY'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Takeaway</span>
            </button>
            <button
              onClick={() => setOrderType('DELIVERY')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                orderType === 'DELIVERY'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Delivery</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes or code..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Category Horizontal Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-3 border-b border-slate-100 no-scrollbar">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Dishes ({items.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                selectedCategory === cat.id
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color || '#10b981' }} />
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Menu Items Touch Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
              <p>No dishes match your filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredItems.map((item) => {
                const hasVariants = item.variants && item.variants.length > 0;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="p-3.5 bg-slate-50/70 hover:bg-emerald-50/40 border border-slate-200/80 hover:border-emerald-400 rounded-2xl text-left transition-all duration-150 flex flex-col justify-between group active:scale-[0.98] shadow-sm hover:shadow"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span
                          className={`w-3.5 h-3.5 border flex items-center justify-center rounded-sm text-[8px] font-bold ${
                            item.isVeg ? 'border-emerald-600 text-emerald-600' : 'border-rose-600 text-rose-600'
                          }`}
                        >
                          ●
                        </span>
                        {item.shortCode && (
                          <span className="text-[10px] font-extrabold text-slate-400 tracking-wider">
                            {item.shortCode}
                          </span>
                        )}
                      </div>
                      <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm line-clamp-2 group-hover:text-emerald-700 transition-colors">
                        {item.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        {item.category?.name}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      <span className="text-sm font-black text-slate-900">
                        {formatCurrency(item.basePrice)}
                      </span>
                      {hasVariants ? (
                        <span className="text-[10px] bg-slate-200/80 px-2 py-0.5 rounded-full font-bold text-slate-700">
                          Custom
                        </span>
                      ) : (
                        <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Cart & Checkout Sidebar */}
      <div className="w-full lg:w-96 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600" />
              <h3 className="font-black text-slate-900 text-sm">Active Order</h3>
              <Badge variant="normal">{cart.length} items</Badge>
            </div>

            {/* Held Orders Pill */}
            {heldOrders.length > 0 && (
              <button
                onClick={() => setShowHeldModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold hover:bg-amber-200 transition-colors"
              >
                <PauseCircle className="w-3.5 h-3.5" />
                <span>Held ({heldOrders.length})</span>
              </button>
            )}
          </div>

          {/* Table & Customer Row */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {orderType === 'DINE_IN' && (
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-400">Table</span>
                <select
                  value={selectedTable?.id || ''}
                  onChange={(e) => {
                    const t = tables.find((tbl) => tbl.id === e.target.value);
                    setSelectedTable(t || null);
                  }}
                  className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-800 outline-none"
                >
                  <option value="">Select Table...</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.tableNumber} ({t.capacity}p) {t.status !== 'AVAILABLE' ? '• Occupied' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={`flex flex-col ${orderType !== 'DINE_IN' ? 'col-span-2' : ''}`}>
              <span className="text-[10px] uppercase font-bold text-slate-400">Customer</span>
              <select
                value={selectedCustomer?.id || ''}
                onChange={(e) => {
                  const c = customers.find((cust) => cust.id === e.target.value);
                  setSelectedCustomer(c || null);
                }}
                className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-800 outline-none"
              >
                <option value="">Walk-in Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone || 'No phone'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs py-12">
              <ShoppingBag className="w-10 h-10 stroke-[1.5] mb-2 text-slate-300" />
              <p className="font-semibold text-slate-600">Cart is empty</p>
              <p className="text-[11px] text-slate-400 mt-1">Tap items on the left to start order</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.cartItemId} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 text-xs">{item.name}</span>
                    {item.addons && item.addons.length > 0 && (
                      <span className="text-[10px] text-slate-400 block">
                        + {item.addons.map((a: any) => a.name).join(', ')}
                      </span>
                    )}
                    {item.notes && (
                      <span className="text-[10px] text-amber-600 font-medium italic block">
                        &quot;{item.notes}&quot;
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-black text-slate-900">
                    {formatCurrency(item.totalPrice)}
                  </span>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-slate-400 font-medium">
                    {formatCurrency(item.unitPrice)} each
                  </span>
                  <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      onClick={() => updateQuantity(item.cartItemId, -1)}
                      className="w-5 h-5 rounded-md bg-white text-slate-700 flex items-center justify-center hover:bg-slate-200 transition-colors shadow-sm"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-black text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.cartItemId, 1)}
                      className="w-5 h-5 rounded-md bg-white text-slate-700 flex items-center justify-center hover:bg-slate-200 transition-colors shadow-sm"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bill Summary & Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/80 space-y-3">
          {/* Bill breakdown */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-semibold">{formatCurrency(subtotal)}</span>
            </div>

            {/* Discount selector */}
            <div className="flex justify-between items-center text-slate-600">
              <div className="flex items-center gap-1">
                <span>Discount</span>
                <select
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(parseInt(e.target.value))}
                  className="bg-white border border-slate-200 rounded px-1 text-[11px] font-bold"
                >
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                  <option value={10}>10%</option>
                  <option value={15}>15%</option>
                  <option value={20}>20%</option>
                </select>
              </div>
              <span className="font-semibold text-rose-600">
                -{formatCurrency(discountAmount)}
              </span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>GST Tax (5%)</span>
              <span className="font-semibold">{formatCurrency(taxAmount)}</span>
            </div>

            {orderType === 'DELIVERY' && (
              <div className="flex justify-between text-slate-600">
                <span>Delivery Charge</span>
                <span className="font-semibold">{formatCurrency(deliveryFee)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-slate-900">
              <span>Total Payable</span>
              <span className="text-emerald-700">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleHoldOrder}
              disabled={cart.length === 0}
              className="py-2.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 disabled:opacity-40 transition-colors"
            >
              <PauseCircle className="w-3.5 h-3.5" />
              <span>Hold Order</span>
            </button>
            <button
              onClick={() => setCart([])}
              disabled={cart.length === 0}
              className="py-2.5 px-3 bg-white hover:bg-rose-50 border border-slate-300 hover:border-rose-300 rounded-xl text-xs font-bold text-rose-600 flex items-center justify-center gap-1.5 disabled:opacity-40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>

          {/* Large Checkout Button */}
          <button
            onClick={() => setShowPaymentModal(true)}
            disabled={cart.length === 0}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-extrabold text-sm shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-[0.98]"
          >
            <span>Proceed to Payment</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MODAL 1: Item Customizer (Variants & Add-ons) */}
      <Modal
        isOpen={!!customizingItem}
        onClose={() => setCustomizingItem(null)}
        title={`Customize ${customizingItem?.name || ''}`}
        maxWidth="md"
      >
        <div className="space-y-4">
          {/* Variants */}
          {customizingItem?.variants && customizingItem.variants.length > 0 && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Select Size / Variant
              </label>
              <div className="grid grid-cols-2 gap-2">
                {customizingItem.variants.map((v: any) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`p-3 rounded-xl border text-left font-bold text-xs flex justify-between items-center transition-all ${
                      selectedVariant?.id === v.id
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span>{v.name}</span>
                    <span>{formatCurrency(v.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add-ons */}
          {customizingItem?.addons && customizingItem.addons.length > 0 && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Add-ons / Extras
              </label>
              <div className="grid grid-cols-2 gap-2">
                {customizingItem.addons.map((addon: any) => {
                  const isChecked = selectedAddons.some((a) => a.id === addon.id);
                  return (
                    <button
                      key={addon.id}
                      onClick={() => {
                        if (isChecked) {
                          setSelectedAddons(selectedAddons.filter((a) => a.id !== addon.id));
                        } else {
                          setSelectedAddons([...selectedAddons, addon]);
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-left text-xs font-semibold flex justify-between items-center transition-all ${
                        isChecked
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                            isChecked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3" />}
                        </div>
                        <span>{addon.name}</span>
                      </div>
                      <span>+{formatCurrency(addon.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Special Cooking Note */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Kitchen Instructions / Notes
            </label>
            <input
              type="text"
              value={itemNote}
              onChange={(e) => setItemNote(e.target.value)}
              placeholder="e.g. Less spicy, well cooked, extra crispy..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            onClick={() => {
              addToCartDirect(customizingItem, selectedVariant, selectedAddons, itemNote);
              setCustomizingItem(null);
            }}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-md transition-all mt-4"
          >
            Add to Order
          </button>
        </div>
      </Modal>

      {/* MODAL 2: Payment Finalization */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Finalize Payment & Settle Order"
        maxWidth="lg"
      >
        <div className="space-y-5">
          <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs uppercase font-bold text-slate-400">Total Payable</span>
              <h2 className="text-3xl font-black text-emerald-400">{formatCurrency(grandTotal)}</h2>
            </div>
            <div className="text-right text-xs text-slate-400">
              <span>{cart.length} items</span>
              <span className="block font-bold text-white capitalize">{orderType.replace('_', ' ')}</span>
            </div>
          </div>

          {/* Payment Method Switcher */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Select Payment Method
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => setPaymentMethod('UPI')}
                className={`p-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-1.5 transition-all ${
                  paymentMethod === 'UPI'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <QrCode className="w-5 h-5 text-emerald-600" />
                <span>UPI / QR</span>
              </button>
              <button
                onClick={() => setPaymentMethod('CASH')}
                className={`p-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-1.5 transition-all ${
                  paymentMethod === 'CASH'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Banknote className="w-5 h-5 text-emerald-600" />
                <span>Cash</span>
              </button>
              <button
                onClick={() => setPaymentMethod('CARD')}
                className={`p-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-1.5 transition-all ${
                  paymentMethod === 'CARD'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <span>Card</span>
              </button>
              <button
                onClick={() => setPaymentMethod('SPLIT')}
                className={`p-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-1.5 transition-all ${
                  paymentMethod === 'SPLIT'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Scale className="w-5 h-5 text-emerald-600" />
                <span>Split</span>
              </button>
            </div>
          </div>

          {/* Cash Change Calculator */}
          {paymentMethod === 'CASH' && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Cash Tendered by Customer
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={cashTendered || ''}
                  onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                  placeholder="Enter cash amount..."
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setCashTendered(grandTotal)}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-xs font-bold text-slate-700"
                >
                  Exact ({formatCurrency(grandTotal)})
                </button>
              </div>

              {cashTendered >= grandTotal && (
                <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-xs font-bold">
                  <span className="text-slate-600">Change Due to Customer:</span>
                  <span className="text-emerald-700 text-sm">
                    {formatCurrency(cashTendered - grandTotal)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Split Payment Form */}
          {paymentMethod === 'SPLIT' && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span>Cash Amount:</span>
                <input
                  type="number"
                  value={splitPayments.cash || ''}
                  onChange={(e) => setSplitPayments({ ...splitPayments, cash: parseFloat(e.target.value) || 0 })}
                  className="w-28 px-2 py-1 bg-white border border-slate-300 rounded-lg text-right font-bold"
                />
              </div>
              <div className="flex items-center justify-between">
                <span>UPI Amount:</span>
                <input
                  type="number"
                  value={splitPayments.upi || ''}
                  onChange={(e) => setSplitPayments({ ...splitPayments, upi: parseFloat(e.target.value) || 0 })}
                  className="w-28 px-2 py-1 bg-white border border-slate-300 rounded-lg text-right font-bold"
                />
              </div>
              <div className="flex items-center justify-between">
                <span>Card Amount:</span>
                <input
                  type="number"
                  value={splitPayments.card || ''}
                  onChange={(e) => setSplitPayments({ ...splitPayments, card: parseFloat(e.target.value) || 0 })}
                  className="w-28 px-2 py-1 bg-white border border-slate-300 rounded-lg text-right font-bold"
                />
              </div>
            </div>
          )}

          <button
            onClick={handleFinalizeOrder}
            disabled={isProcessingPayment}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-emerald-950/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isProcessingPayment ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Confirm Payment & Deduct Inventory</span>
              </>
            )}
          </button>
        </div>
      </Modal>

      {/* MODAL 3: Held Orders Drawer */}
      <Modal
        isOpen={showHeldModal}
        onClose={() => setShowHeldModal(false)}
        title="Held Orders in Memory"
        maxWidth="md"
      >
        <div className="divide-y divide-slate-100">
          {heldOrders.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-6">No orders currently on hold.</p>
          ) : (
            heldOrders.map((held) => (
              <div key={held.id} className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 text-xs">{held.id}</span>
                  <span className="text-[11px] text-slate-400 block">
                    {held.cart.length} items • Held at{' '}
                    {new Date(held.heldAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <button
                  onClick={() => handleResumeOrder(held)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  <span>Resume</span>
                </button>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* MODAL 4: Printable Receipt & Order Summary */}
      <Modal
        isOpen={!!completedOrder}
        onClose={() => setCompletedOrder(null)}
        title="Order Succeeded & Receipt Generated"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-2xl flex items-center gap-2 text-xs font-semibold">
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>KOT sent to kitchen & inventory deducted in ledger automatically!</span>
          </div>

          {/* Printable Thermal Receipt Box */}
          <div id="printable-receipt" className="bg-white border-2 border-dashed border-slate-300 p-5 rounded-2xl font-mono text-xs text-slate-900 space-y-3">
            <div className="text-center border-b border-slate-200 pb-2">
              <h3 className="font-black text-sm tracking-wider uppercase">{user?.restaurantName || 'Demo Kitchen'}</h3>
              <p className="text-[10px] text-slate-500">GSTIN: GSTIN27AAAAA0000A1Z5</p>
              <p className="text-[10px] text-slate-500">Order: {completedOrder?.orderNumber}</p>
              <p className="text-[10px] text-slate-500">
                {new Date(completedOrder?.createdAt || Date.now()).toLocaleString()}
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {completedOrder?.items?.map((i: any) => (
                <div key={i.id} className="py-1 flex justify-between">
                  <span>
                    {i.quantity}x {i.name}
                  </span>
                  <span>{formatCurrency(i.totalPrice)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-2 space-y-1">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(completedOrder?.subtotal || 0)}</span>
              </div>
              {completedOrder?.discountAmount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount:</span>
                  <span>-{formatCurrency(completedOrder.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Tax (GST 5%):</span>
                <span>{formatCurrency(completedOrder?.taxAmount || 0)}</span>
              </div>
              <div className="flex justify-between font-black text-sm pt-1 border-t border-slate-300">
                <span>GRAND TOTAL:</span>
                <span>{formatCurrency(completedOrder?.totalAmount || 0)}</span>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-400 pt-2 border-t border-slate-200">
              Thank you for dining with us!
            </div>
          </div>

          {/* Print & Close Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print Thermal Receipt</span>
            </button>
            <button
              onClick={() => setCompletedOrder(null)}
              className="py-3 px-6 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
