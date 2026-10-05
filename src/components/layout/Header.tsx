'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Building2,
  ChevronDown,
  LogOut,
  User,
  Shield,
  CheckCircle2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

interface HeaderProps {
  user: any;
  activeOutletId: string;
  onOutletChange: (outletId: string) => void;
}

export function Header({ user, activeOutletId, onOutletChange }: HeaderProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
        const unread = (data.notifications || []).filter((n: any) => !n.isRead).length;
        setUnreadCount(unread);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // ignore
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch {
      router.push('/login');
    }
  };

  const currentOutlet = user?.outlets?.find((o: any) => o.id === activeOutletId) || user?.outlets?.[0];

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-30 flex-shrink-0">
      {/* Left: Outlet Switcher */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
          <Building2 className="w-4 h-4 text-emerald-600" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-slate-400 leading-none">Active Outlet</span>
            <select
              value={activeOutletId}
              onChange={(e) => onOutletChange(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 outline-none cursor-pointer pr-4"
            >
              {user?.outlets?.map((outlet: any) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name} {outlet.isDefault ? '(Default)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <span className="hidden md:inline-block text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
          {user?.restaurantName}
        </span>
      </div>

      {/* Right: Notifications & User Profile */}
      <div className="flex items-center gap-3 relative">
        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-md animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Popover */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-800 text-sm">Notifications</h4>
                  {unreadCount > 0 && <Badge variant="warning">{unreadCount} new</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 mt-2">
                {notifications.length === 0 ? (
                  <p className="text-center text-slate-400 text-xs py-8">No notifications yet.</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`py-3 px-2 flex items-start gap-3 rounded-lg transition-colors ${
                        !n.isRead ? 'bg-emerald-50/50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="mt-0.5">
                        {n.type === 'LOW_STOCK' || n.type === 'LARGE_VARIANCE' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        )}
                      </div>
                      <div className="flex-1 text-xs">
                        <p className="font-semibold text-slate-800">{n.title}</p>
                        <p className="text-slate-500 text-[11px] mt-0.5">{n.message}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Card & Logout */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-xs shadow-sm">
            {user?.name?.slice(0, 2).toUpperCase() || 'RC'}
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-bold text-slate-800 leading-tight">{user?.name}</span>
            <span className="text-[10px] text-slate-500 font-medium capitalize">
              {user?.role?.replace('_', ' ').toLowerCase()}
            </span>
          </div>

          <button
            onClick={handleLogout}
            title="Log Out"
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
