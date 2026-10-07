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
          <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 bg-slate-50/70">
            {children}
          </main>
        </div>
      </div>
    </OutletContext.Provider>
  );
}
