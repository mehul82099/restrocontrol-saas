'use client';

import React, { useState, useEffect } from 'react';
import {
  ScrollText,
  Plus,
  Search,
  DollarSign,
  TrendingDown,
  PieChart,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/utils';

interface RecipeItem {
  id?: string;
  ingredientId: string;
  quantity: number;
  unit: string;
  wastePercentage: number;
  notes?: string;
  ingredient?: {
    name: string;
    costPerUnit: number;
    unit: string;
  };
}

interface Recipe {
  id: string;
  name: string;
  menuItemId: string;
  variantId?: string | null;
  yieldQuantity: number;
  yieldUnit: string;
  prepTimeMinutes: number;
  preparationNotes?: string;
  calculatedCost: number;
  sellingPrice: number;
  foodCostPercentage: number;
  grossContribution: number;
  menuItem: {
    name: string;
    basePrice: number;
    category: {
      name: string;
    };
  };
  variant?: {
    name: string;
    price: number;
  };
  items: RecipeItem[];
}

interface MenuItemOption {
  id: string;
  name: string;
  basePrice: number;
  category?: { name: string };
  variants: { id: string; name: string; price: number }[];
}

interface IngredientOption {
  id: string;
  name: string;
  unit: string;
  costPerUnit: number;
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([]);
  const [ingredients, setIngredients] = useState<IngredientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [recipeName, setRecipeName] = useState('');
  const [yieldQuantity, setYieldQuantity] = useState('1');
  const [yieldUnit, setYieldUnit] = useState('PORTION');
  const [prepTimeMinutes, setPrepTimeMinutes] = useState('15');
  const [preparationNotes, setPreparationNotes] = useState('');
  const [formItems, setFormItems] = useState<
    { ingredientId: string; quantity: string; unit: string; wastePercentage: string; notes: string }[]
  >([]);

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/recipes');
      const data = await res.json();
      if (data.success) {
        setRecipes(data.recipes);
      }
    } catch (err) {
      console.error('Failed to load recipes', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const [menuRes, ingRes] = await fetch('/api/menu').then((r) => r.json()).catch(() => ({})),
        ingData = await fetch('/api/ingredients').then((r) => r.json()).catch(() => ({}));

      if (menuRes.items) {
        setMenuItems(menuRes.items);
      }
      if (ingData.ingredients) {
        setIngredients(ingData.ingredients);
      }
    } catch (err) {
      console.error('Failed to fetch options', err);
    }
  };

  useEffect(() => {
    fetchRecipes();
    fetchOptions();
  }, []);

  const openCreateModal = () => {
    setSelectedMenuItemId('');
    setSelectedVariantId('');
    setRecipeName('');
    setYieldQuantity('1');
    setYieldUnit('PORTION');
    setPrepTimeMinutes('15');
    setPreparationNotes('');
    setFormItems([{ ingredientId: '', quantity: '100', unit: 'G', wastePercentage: '0', notes: '' }]);
    setIsModalOpen(true);
  };

  const addFormItem = () => {
    setFormItems([...formItems, { ingredientId: '', quantity: '100', unit: 'G', wastePercentage: '0', notes: '' }]);
  };

  const removeFormItem = (index: number) => {
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const updateFormItem = (index: number, field: string, value: string) => {
    const updated = [...formItems];
    updated[index] = { ...updated[index], [field]: value };
    setFormItems(updated);
  };

  const handleMenuItemChange = (id: string) => {
    setSelectedMenuItemId(id);
    const item = menuItems.find((m) => m.id === id);
    if (item) {
      setRecipeName(`${item.name} Recipe`);
      setSelectedVariantId('');
    }
  };

  // Calculate live cost in modal
  const liveCost = formItems.reduce((sum, item) => {
    const ing = ingredients.find((i) => i.id === item.ingredientId);
    if (!ing) return sum;
    const qty = parseFloat(item.quantity) || 0;
    // basic unit conversion to calculate rough cost
    let qtyInStandard = qty;
    if (item.unit === 'G' && ing.unit === 'KG') qtyInStandard = qty / 1000;
    else if (item.unit === 'ML' && ing.unit === 'L') qtyInStandard = qty / 1000;
    else if (item.unit === 'KG' && ing.unit === 'G') qtyInStandard = qty * 1000;
    else if (item.unit === 'L' && ing.unit === 'ML') qtyInStandard = qty * 1000;

    const wasteFactor = 1 + (parseFloat(item.wastePercentage) || 0) / 100;
    return sum + qtyInStandard * ing.costPerUnit * wasteFactor;
  }, 0);

  const selectedItem = menuItems.find((m) => m.id === selectedMenuItemId);
  const selectedVariant = selectedItem?.variants?.find((v) => v.id === selectedVariantId);
  const currentSellingPrice = selectedVariant ? selectedVariant.price : selectedItem?.basePrice || 0;
  const liveFoodCostPct = currentSellingPrice > 0 ? (liveCost / currentSellingPrice) * 100 : 0;
  const liveMargin = currentSellingPrice - liveCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMenuItemId || formItems.length === 0) {
      alert('Please select a menu item and add at least one ingredient.');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuItemId: selectedMenuItemId,
          variantId: selectedVariantId || undefined,
          name: recipeName,
          yieldQuantity,
          yieldUnit,
          prepTimeMinutes,
          preparationNotes,
          items: formItems.filter((i) => i.ingredientId),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save recipe');
      }

      setIsModalOpen(false);
      await fetchRecipes();
    } catch (err: any) {
      alert(err.message || 'Error saving recipe');
    } finally {
      setSaving(false);
    }
  };

  const filtered = recipes.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.menuItem.name.toLowerCase().includes(search.toLowerCase()) ||
      r.menuItem.category?.name.toLowerCase().includes(search.toLowerCase())
  );

  const avgFoodCost =
    recipes.length > 0
      ? Math.round((recipes.reduce((acc, r) => acc + r.foodCostPercentage, 0) / recipes.length) * 10) / 10
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ScrollText className="w-7 h-7 text-emerald-600" />
            Recipe Engine & Live Food Costing
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Every dish sold automatically computes and deducts raw ingredient portions from inventory
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Create Recipe
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Recipes</span>
            <ScrollText className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{recipes.length}</span>
            <span className="text-xs text-slate-500">items mapped</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Food Cost %</span>
            <PieChart className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-indigo-600">{avgFoodCost}%</span>
            <span className="text-xs text-emerald-600 font-medium">Industry Benchmark &lt; 35%</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Raw Ingredients</span>
            <DollarSign className="w-5 h-5 text-amber-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{ingredients.length}</span>
            <span className="text-xs text-slate-500">in catalog</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Deduction Method</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-lg font-bold text-slate-900">Automatic / POS</span>
            <span className="text-xs text-emerald-600 font-medium">Real-time</span>
          </div>
        </div>
      </div>

      {/* Main Content: Search & List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search recipes, dish name, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading recipes...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <ScrollText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">No recipes found</p>
            <p className="text-sm text-slate-500 mt-1">Map recipes to your menu items to enable automated inventory deductions.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Menu Item & Recipe</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Ingredients</th>
                  <th className="py-3 px-4 text-right">Recipe Cost</th>
                  <th className="py-3 px-4 text-right">Selling Price</th>
                  <th className="py-3 px-4 text-right">Food Cost %</th>
                  <th className="py-3 px-4 text-right">Gross Margin</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((recipe) => {
                  const isHighCost = recipe.foodCostPercentage > 40;
                  return (
                    <tr key={recipe.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{recipe.menuItem?.name}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>{recipe.name}</span>
                          {recipe.variant && (
                            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-sm font-medium text-[10px]">
                              {recipe.variant.name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg text-xs font-medium">
                          {recipe.menuItem?.category?.name || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="font-medium text-slate-800">{recipe.items?.length || 0}</span> items
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-800">
                        {formatCurrency(recipe.calculatedCost)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(recipe.sellingPrice)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${
                            isHighCost
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {recipe.foodCostPercentage}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                        +{formatCurrency(recipe.grossContribution)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedRecipe(recipe)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <Modal
          isOpen={!!selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
          title={`Recipe: ${selectedRecipe.name}`}
          size="lg"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-[11px] text-slate-500 font-bold uppercase">Dish</span>
                <p className="font-bold text-slate-900 mt-0.5">{selectedRecipe.menuItem.name}</p>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-bold uppercase">Recipe Cost</span>
                <p className="font-bold text-slate-900 mt-0.5">{formatCurrency(selectedRecipe.calculatedCost)}</p>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-bold uppercase">Food Cost %</span>
                <p className="font-bold text-emerald-600 mt-0.5">{selectedRecipe.foodCostPercentage}%</p>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-bold uppercase">Gross Contribution</span>
                <p className="font-bold text-emerald-600 mt-0.5">+{formatCurrency(selectedRecipe.grossContribution)}</p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Ingredient Composition (Per Order)
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Ingredient</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      <th className="py-2.5 px-3 text-right">Waste %</th>
                      <th className="py-2.5 px-3">Prep Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedRecipe.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {item.ingredient?.name || 'Raw Ingredient'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">
                          {item.wastePercentage}%
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-xs">
                          {item.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedRecipe.preparationNotes && (
              <div className="bg-amber-50/70 border border-amber-200/80 p-3 rounded-xl text-xs text-amber-900">
                <span className="font-bold">Preparation Instructions: </span>
                {selectedRecipe.preparationNotes}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Create Recipe Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Recipe Composition"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Menu Item *</label>
              <select
                value={selectedMenuItemId}
                onChange={(e) => handleMenuItemChange(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              >
                <option value="">Select menu item...</option>
                {menuItems.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({formatCurrency(m.basePrice)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Variant (Optional)</label>
              <select
                value={selectedVariantId}
                onChange={(e) => setSelectedVariantId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                disabled={!selectedItem?.variants || selectedItem.variants.length === 0}
              >
                <option value="">Base Dish (No Variant)</option>
                {selectedItem?.variants?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({formatCurrency(v.price)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Recipe Name *</label>
              <input
                type="text"
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                placeholder="e.g. Standard Biryani Batch"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Yield Quantity</label>
              <input
                type="number"
                step="0.1"
                value={yieldQuantity}
                onChange={(e) => setYieldQuantity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Yield Unit</label>
              <input
                type="text"
                value={yieldUnit}
                onChange={(e) => setYieldUnit(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
          </div>

          {/* Dynamic Ingredients */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Raw Ingredients Deduction Breakdown
              </span>
              <button
                type="button"
                onClick={addFormItem}
                className="text-xs text-emerald-600 font-bold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Ingredient
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {formItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <select
                    value={item.ingredientId}
                    onChange={(e) => updateFormItem(idx, 'ingredientId', e.target.value)}
                    required
                    className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="">Select ingredient...</option>
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({formatCurrency(ing.costPerUnit)}/{ing.unit})
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    step="0.01"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateFormItem(idx, 'quantity', e.target.value)}
                    required
                    className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-right font-mono"
                  />

                  <select
                    value={item.unit}
                    onChange={(e) => updateFormItem(idx, 'unit', e.target.value)}
                    className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="G">G</option>
                    <option value="KG">KG</option>
                    <option value="ML">ML</option>
                    <option value="L">L</option>
                    <option value="PCS">PCS</option>
                    <option value="PORTION">PORTION</option>
                  </select>

                  <input
                    type="number"
                    placeholder="Waste %"
                    title="Prep Wastage %"
                    value={item.wastePercentage}
                    onChange={(e) => updateFormItem(idx, 'wastePercentage', e.target.value)}
                    className="w-16 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-right"
                  />

                  {formItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFormItem(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Live Costing Bar */}
          <div className="bg-slate-900 text-white p-3.5 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Live Recipe Cost</span>
              <span className="text-base font-bold text-emerald-400">{formatCurrency(liveCost)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Selling Price</span>
              <span className="text-base font-bold">{formatCurrency(currentSellingPrice)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Food Cost %</span>
              <span className={`text-base font-bold ${liveFoodCostPct > 40 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {liveFoodCostPct.toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Gross Margin</span>
              <span className="text-base font-bold text-white">+{formatCurrency(liveMargin)}</span>
            </div>
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
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl shadow-xs disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Recipe'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
