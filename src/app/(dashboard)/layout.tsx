'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

interface OutletContextType {
  activeOutletId: string;
  setActiveOutletId: (id: string) => void;
  user: any;
  refreshUser: () => Promise<void>;
}

export const OutletContext = createContext<OutletContextType>({
  activeOutletId: '',
  setActiveOutletId: () => {},
  user: null,
  refreshUser: async () => {},
});

export const useOutlet = () => useContext(OutletContext);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [trial, setTrial] = useState<any>(null);
  const [activeOutletId, setActiveOutletId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        setTrial(data.trial || null);
        if (!activeOutletId) {
          setActiveOutletId(data.user.activeOutletId || data.user.outlets?.[0]?.id || '');
        }
      } else {
        router.push('/login');
      }
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-400">Loading RestroControl...</p>
        </div>
      </div>
    );
  }

  // POS screen can be viewed in ultra-clean full-width mode, but keeps layout available
  return (
    <OutletContext.Provider
      value={{
        activeOutletId,
        setActiveOutletId,
        user,
        refreshUser: fetchUser,
      }}
    >
      <div className="flex h-[100dvh] bg-slate-50 overflow-hidden">
        {/* Sidebar */}
        <Sidebar userRole={user?.role} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header
            user={user}
            activeOutletId={activeOutletId}
            onOutletChange={setActiveOutletId}
            onMenuClick={() => setSidebarOpen(true)}
          />
          {trial?.isTrial && !trial.expired && (
            <div className="bg-emerald-600 text-white text-xs sm:text-sm font-semibold px-3 sm:px-6 py-2 text-center">
              Free trial: {trial.daysRemaining} {trial.daysRemaining === 1 ? 'day' : 'days'} remaining
            </div>
          )}
          <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 bg-slate-50/70">
            {trial?.expired && pathname !== '/plans' ? (
              <div className="max-w-lg mx-auto mt-10 sm:mt-20 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 text-center shadow-sm">
                <h2 className="text-xl font-black text-slate-900">Your 14-day free trial has ended</h2>
                <p className="text-sm text-slate-600 mt-3">
                  Access to {user?.restaurantName || 'your restaurant'} is paused. Your data is kept safe. Pick a plan to continue.
                </p>
                <button
                  onClick={() => router.push('/plans')}
                  className="mt-6 mr-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-500"
                >
                  View plan (₹499/month)
                </button>
                <button
                  onClick={async () => {
                    await fetch('/api/auth/logout', { method: 'POST' });
                    router.push('/login');
                  }}
                  className="mt-6 px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800"
                >
                  Sign out
                </button>
              </div>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </OutletContext.Provider>
  );
}
