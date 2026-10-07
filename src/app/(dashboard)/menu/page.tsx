'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Tag,
  Leaf,
  Drumstick,
  DollarSign,
  ChevronRight,
  FolderPlus,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';

interface Variant {
  id?: string;
  name: string;
  price: number;
}

interface Addon {
  id?: string;
  name: string;
  price: number;
}

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  isVeg: boolean;
  taxRate: number;
  categoryId: string;
  category: { id: string; name: string };
  variants: Variant[];
  addons: Addon[];
  recipes?: any[];
}

interface Category {
  id: string;
  name: string;
  _count?: { menuItems: number };
}

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Add Item Modal
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [isVeg, setIsVeg] = useState(true);
  const [taxRate, setTaxRate] = useState('5');
  const [variants, setVariants] = useState<{ name: string; price: string }[]>([]);
  const [addons, setAddons] = useState<{ name: string; price: string }[]>([]);

  // Add Category Modal
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsRes, catRes] = await Promise.all([
        fetch('/api/menu').then((r) => r.json()),
        fetch('/api/categories').then((r) => r.json()),
      ]);

      if (itemsRes.items) setItems(itemsRes.items);
      if (catRes.categories) setCategories(catRes.categories);
    } catch (err) {
      console.error('Failed to load menu', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddItemModal = () => {
    setName('');
    setCategoryId(categories[0]?.id || '');
    setDescription('');
    setBasePrice('200');
    setIsVeg(true);
    setTaxRate('5');
    setVariants([]);
    setAddons([]);
    setIsItemModalOpen(true);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingItem(true);
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          categoryId,
          description,
          basePrice,
          isVeg,
          taxRate,
          variants: variants.filter((v) => v.name && v.price),
          addons: addons.filter((a) => a.name && a.price),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create menu item');
      }

      setIsItemModalOpen(false);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Error saving menu item');
    } finally {
      setSavingItem(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    try {
      setSavingCat(true);
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: catName }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create category');

      setIsCatModalOpen(false);
      setCatName('');
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Error saving category');
    } finally {
      setSavingCat(false);
    }
  };

  const filtered = items.filter((item) => {
    const matchesCat = selectedCategory === 'ALL' || item.categoryId === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category?.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-7 h-7 text-emerald-600" />
            Menu & Dish Catalog
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Organize dishes, portions, add-ons, and bind them to the real-time recipe engine
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsCatModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-all"
          >
            <FolderPlus className="w-4 h-4 text-slate-600" />
            Add Category
          </button>
          <button
            onClick={openAddItemModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Menu Item
          </button>
        </div>
      </div>

      {/* Category Pills Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            selectedCategory === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          All Dishes ({items.length})
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              selectedCategory === c.id
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {c.name} {c._count?.menuItems !== undefined ? `(${c._count.menuItems})` : ''}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search dishes or categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{filtered.length}</strong> items
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading catalog...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Layers className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">No dishes in this category</p>
            <p className="text-sm text-slate-500 mt-1">Add items or change your search filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Item Details</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Selling Price</th>
                  <th className="py-3 px-4">Variants</th>
                  <th className="py-3 px-4">Add-ons</th>
                  <th className="py-3 px-4 text-center">Recipe Engine</th>
                  <th className="py-3 px-4 text-center">Tax %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((item) => {
                  const hasRecipe = item.recipes && item.recipes.length > 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${
                              item.isVeg ? 'border-emerald-600' : 'border-rose-600'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`}
                            />
                          </span>
                          <div>
                            <span className="font-bold text-slate-900">{item.name}</span>
                            {item.description && (
                              <p className="text-xs text-slate-400 line-clamp-1">{item.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg text-xs font-medium">
                          {item.category?.name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(item.basePrice)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs">
                        {item.variants && item.variants.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.variants.map((v, i) => (
                              <span key={i} className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md text-[11px]">
                                {v.name}: {formatCurrency(v.price)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs">
                        {item.addons && item.addons.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.addons.map((a, i) => (
                              <span key={i} className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md text-[11px]">
                                {a.name} (+{formatCurrency(a.price)})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {hasRecipe ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Linked
                          </span>
                        ) : (
                          <Link
                            href="/recipes"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold hover:bg-amber-100 transition-colors"
                          >
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Link Recipe
                          </Link>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-xs font-mono font-medium text-slate-600">
                        {item.taxRate}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Menu Item Modal */}
      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title="Add New Menu Item"
        maxWidth="lg"
      >
        <form onSubmit={handleAddItem} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Item Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mutton Rogan Josh"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Base Price (₹) *</label>
              <input
                type="number"
                step="1"
                required
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Dietary</label>
              <select
                value={isVeg ? 'VEG' : 'NON_VEG'}
                onChange={(e) => setIsVeg(e.target.value === 'VEG')}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              >
                <option value="VEG">Vegetarian</option>
                <option value="NON_VEG">Non-Vegetarian</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">GST Tax Rate %</label>
              <input
                type="number"
                step="0.1"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Flavor notes, spice level..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
          </div>

          {/* Variants section */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase">Portion Variants (e.g. Half / Full)</span>
              <button
                type="button"
                onClick={() => setVariants([...variants, { name: '', price: '' }])}
                className="text-xs text-emerald-600 font-bold hover:underline"
              >
                + Add Variant
              </button>
            </div>
            {variants.map((v, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="e.g. Half Portion"
                  value={v.name}
                  onChange={(e) => {
                    const next = [...variants];
                    next[i].name = e.target.value;
                    setVariants(next);
                  }}
                  className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
                <input
                  type="number"
                  placeholder="Price ₹"
                  value={v.price}
                  onChange={(e) => {
                    const next = [...variants];
                    next[i].price = e.target.value;
                    setVariants(next);
                  }}
                  className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setVariants(variants.filter((_, idx) => idx !== i))}
                  className="px-2 text-rose-500 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Add-ons section */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase">Custom Add-ons (e.g. Extra Cheese)</span>
              <button
                type="button"
                onClick={() => setAddons([...addons, { name: '', price: '' }])}
                className="text-xs text-emerald-600 font-bold hover:underline"
              >
                + Add Add-on
              </button>
            </div>
            {addons.map((a, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="e.g. Extra Gravy"
                  value={a.name}
                  onChange={(e) => {
                    const next = [...addons];
                    next[i].name = e.target.value;
                    setAddons(next);
                  }}
                  className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
                <input
                  type="number"
                  placeholder="Price ₹"
                  value={a.price}
                  onChange={(e) => {
                    const next = [...addons];
                    next[i].price = e.target.value;
                    setAddons(next);
                  }}
                  className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setAddons(addons.filter((_, idx) => idx !== i))}
                  className="px-2 text-rose-500 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsItemModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingItem}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs disabled:opacity-50"
            >
              {savingItem ? 'Creating...' : 'Create Dish'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Category Modal */}
      <Modal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        title="Add Menu Category"
      >
        <form onSubmit={handleAddCategory} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category Name *</label>
            <input
              type="text"
              required
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="e.g. Desserts, Mocktails..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCatModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingCat}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs disabled:opacity-50"
            >
              {savingCat ? 'Saving...' : 'Save Category'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
