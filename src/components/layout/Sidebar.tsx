'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Store,
  ChefHat,
  Receipt,
  UtensilsCrossed,
  ScrollText,
  Boxes,
  Beef,
  Scale,
  Trash2,
  ClipboardCheck,
  ShoppingBag,
  TrendingDown,
  BarChart3,
  Users,
  Building2,
  CreditCard,
  ShieldAlert,
  Settings,
  Sparkles,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  highlight?: boolean;
  roles?: string[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export function Sidebar({ userRole = 'OWNER', open = false, onClose = () => {} }: { userRole?: string; open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();

  const sections: NavSection[] = [
    {
      title: 'POS & KITCHEN',
      items: [
        { name: 'Point of Sale (POS)', href: '/pos', icon: Store, roles: ['OWNER', 'MANAGER', 'CASHIER'] },
        { name: 'Kitchen Display (KDS)', href: '/kot', icon: ChefHat, roles: ['OWNER', 'MANAGER', 'KITCHEN_STAFF'] },
        { name: 'Dining Tables', href: '/tables', icon: UtensilsCrossed, roles: ['OWNER', 'MANAGER', 'CASHIER'] },
        { name: 'Orders & Bills', href: '/orders', icon: Receipt, roles: ['OWNER', 'MANAGER', 'CASHIER'] },
      ],
    },
    {
      title: 'INVENTORY & RECIPES',
      items: [
        {
          name: 'Expected vs Actual',
          href: '/variance',
          icon: Sparkles,
          highlight: true,
          roles: ['OWNER', 'MANAGER', 'INVENTORY_MANAGER'],
        },
        { name: 'Live Stock & Ledger', href: '/inventory', icon: Boxes, roles: ['OWNER', 'MANAGER', 'INVENTORY_MANAGER', 'CASHIER'] },
        { name: 'Recipe Costing', href: '/recipes', icon: ScrollText, roles: ['OWNER', 'MANAGER'] },
        { name: 'Ingredient Master', href: '/ingredients', icon: Beef, roles: ['OWNER', 'MANAGER', 'INVENTORY_MANAGER'] },
        { name: 'Wastage Tracking', href: '/wastage', icon: Trash2, roles: ['OWNER', 'MANAGER', 'INVENTORY_MANAGER'] },
        { name: 'Stock Audits', href: '/stock-count', icon: ClipboardCheck, roles: ['OWNER', 'MANAGER', 'INVENTORY_MANAGER'] },
        { name: 'Purchases & Vendors', href: '/purchases', icon: ShoppingBag, roles: ['OWNER', 'MANAGER', 'INVENTORY_MANAGER'] },
      ],
    },
    {
      title: 'BUSINESS & ANALYTICS',
      items: [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['OWNER', 'MANAGER'] },
        { name: 'Menu Catalog', href: '/menu', icon: Layers, roles: ['OWNER', 'MANAGER'] },
        { name: 'Customer CRM', href: '/customers', icon: Users, roles: ['OWNER', 'MANAGER', 'CASHIER'] },
        { name: 'Reports (20+ Export)', href: '/reports', icon: BarChart3, roles: ['OWNER', 'MANAGER', 'INVENTORY_MANAGER'] },
      ],
    },
    {
      title: 'ADMIN & SAAS',
      items: [
        { name: 'Team & Permissions', href: '/users', icon: Users, roles: ['OWNER', 'MANAGER'] },
        { name: 'Outlets', href: '/outlets', icon: Building2, roles: ['OWNER'] },
        { name: 'SaaS Plan', href: '/plans', icon: CreditCard, roles: ['OWNER'] },
        { name: 'Security Audit Trail', href: '/audit-logs', icon: ShieldAlert, roles: ['OWNER'] },
        { name: 'Settings', href: '/settings', icon: Settings, roles: ['OWNER', 'MANAGER'] },
      ],
    },
  ];

  return (
    <>
    {open && <div className="fixed inset-0 z-40 bg-slate-900/60 lg:hidden" onClick={onClose} aria-hidden="true" />}
    <aside className={cn('w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 h-full border-r border-slate-800 select-none fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800 bg-slate-950/40">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-900/40">
          <Scale className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-extrabold text-white tracking-tight text-lg leading-tight">
            Restro<span className="text-emerald-400">Control</span>
          </h1>
          <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">
            Inventory-First POS
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {sections.map((sec) => {
          const visibleItems = sec.items.filter((item) => !item.roles || item.roles.includes(userRole));
          if (visibleItems.length === 0) return null;

          return (
            <div key={sec.title} className="space-y-1">
              <h4 className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {sec.title}
              </h4>
              <div className="space-y-0.5 pt-1">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all group',
                        isActive
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50 font-semibold'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60',
                        item.highlight && !isActive && 'text-emerald-400 bg-emerald-950/20 border border-emerald-900/30'
                      )}
                    >
                      <Icon
                        className={cn(
                          'w-4 h-4 transition-colors',
                          isActive ? 'text-white' : item.highlight ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                        )}
                      />
                      <span className="flex-1 truncate">{item.name}</span>
                      {item.highlight && !isActive && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Role Pill */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/30">
        <div className="flex items-center justify-between px-3 py-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Signed in as</span>
            <span className="text-xs font-bold text-emerald-400 capitalize">{userRole.replace('_', ' ')}</span>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
        </div>
      </div>
    </aside>
    </>
  );
}
