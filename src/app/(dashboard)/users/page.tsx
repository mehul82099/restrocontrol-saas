'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Shield,
  CheckCircle2,
  Mail,
  Phone,
  Lock,
  UserCheck,
  KeyRound,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatDate } from '@/lib/utils';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'MANAGER' | 'CASHIER' | 'KITCHEN_STAFF' | 'INVENTORY_MANAGER';
  phone?: string;
  isActive: boolean;
  createdAt: string;
}

const ROLE_PERMISSIONS: { [key: string]: { title: string; desc: string; access: string[] } } = {
  OWNER: {
    title: 'Owner',
    desc: 'Unrestricted full control across all outlets, settings, subscriptions, and financial logs',
    access: ['All POS & Orders', 'Recipe Costing & Ingredients', 'Inventory & Ledgers', 'Purchases & Vendors', 'All 20+ Reports', 'User Administration', 'Multi-tenant Outlets', 'Security Audit Logs'],
  },
  MANAGER: {
    title: 'Restaurant Manager',
    desc: 'Supervises floor operations, approves wastage & audits, manages menus and recipes',
    access: ['POS & Dine-in Orders', 'Order Cancellations & Refunds', 'Menu & Recipe Editing', 'Wastage Approval', 'Stock Audit Approval', 'Purchase Receiving', 'Sales & Consumption Reports'],
  },
  CASHIER: {
    title: 'POS Cashier',
    desc: 'Front-of-house billing, taking orders, split payments, receipts, and customer CRM',
    access: ['POS Terminal', 'Dine-in / Takeaway / Delivery', 'Split Payments (Cash, Card, UPI)', 'Receipt Printing', 'Customer Directory'],
  },
  KITCHEN_STAFF: {
    title: 'Kitchen Staff',
    desc: 'Kitchen display screen, receiving KOTs, updating order prep and ready statuses',
    access: ['Kitchen Display (KDS)', 'Live KOT Tickets', 'Accept / Preparing / Ready / Served', 'Table ticket updates'],
  },
  INVENTORY_MANAGER: {
    title: 'Inventory Manager',
    desc: 'Stores, stock audits, raw ingredient purchasing, vendor management, and wastage logging',
    access: ['Live Stock & Ledger', 'Ingredient Thresholds', 'Physical Stock Audits', 'Purchase Orders & Receiving', 'Vendor Management', 'Wastage Logging', 'Inventory Reports'],
  },
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRoleInfo, setShowRoleInfo] = useState(false);

  // Add User Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'OWNER' | 'MANAGER' | 'CASHIER' | 'KITCHEN_STAFF' | 'INVENTORY_MANAGER'>('CASHIER');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('Password123!');
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role, phone, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create user');

      setIsModalOpen(false);
      setName('');
      setEmail('');
      setPhone('');
      setPassword('Password123!');
      await fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Error creating user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-emerald-600" />
            Team & Role-Based Access Control
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Enforce strict role separation: Owner, Manager, Cashier, Kitchen Staff, and Inventory Manager
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRoleInfo(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-all"
          >
            <Shield className="w-4 h-4 text-indigo-600" />
            Role Matrix
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Staff Member
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Staff</span>
            <Users className="w-5 h-5 text-slate-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{users.length}</span>
            <span className="text-xs text-slate-500">accounts</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Status</span>
            <UserCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600">
              {users.filter((u) => u.isActive).length}
            </span>
            <span className="text-xs text-emerald-600 font-medium">enabled</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kitchen & Cashiers</span>
            <KeyRound className="w-5 h-5 text-amber-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-600">
              {users.filter((u) => u.role === 'CASHIER' || u.role === 'KITCHEN_STAFF').length}
            </span>
            <span className="text-xs text-slate-500">floor operators</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inventory & Managers</span>
            <Shield className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-indigo-600">
              {users.filter((u) => u.role === 'MANAGER' || u.role === 'INVENTORY_MANAGER').length}
            </span>
            <span className="text-xs text-slate-500">supervisors</span>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Active Staff Accounts</h3>
          <span className="text-xs text-slate-500 font-medium">Server-side tenant isolation enforced on every request</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading team...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4">Contact Phone</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-900">{u.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-600 flex items-center gap-1.5 mt-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {u.email}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <Shield className="w-3 h-3 text-indigo-500" />
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 font-mono">
                      {u.phone || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 font-mono">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {u.isActive ? (
                        <Badge variant="success">ACTIVE</Badge>
                      ) : (
                        <Badge variant="danger">DISABLED</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role Matrix Modal */}
      <Modal isOpen={showRoleInfo} onClose={() => setShowRoleInfo(false)} title="Role-Based Permissions Matrix" size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {Object.entries(ROLE_PERMISSIONS).map(([roleKey, info]) => (
            <div key={roleKey} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  {info.title}
                </span>
                <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                  {roleKey}
                </span>
              </div>
              <p className="text-xs text-slate-600">{info.desc}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {info.access.map((perm, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px] font-medium text-slate-700"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {perm}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Add User Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Staff Account">
        <form onSubmit={handleAddUser} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@restaurant.com"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Role *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"
              >
                <option value="OWNER">Owner (Full Access)</option>
                <option value="MANAGER">Manager (Supervisory)</option>
                <option value="CASHIER">Cashier (POS & CRM)</option>
                <option value="KITCHEN_STAFF">Kitchen Staff (KDS/KOT)</option>
                <option value="INVENTORY_MANAGER">Inventory Manager (Stock & PO)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Temporary Password *</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
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
              {saving ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
