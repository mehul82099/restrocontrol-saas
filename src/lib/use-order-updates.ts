'use client';
import { useEffect, useRef } from 'react';
export function useOrderUpdates(outletId: string, refresh: () => void) {
  const callback = useRef(refresh); callback.current = refresh;
  useEffect(() => {
    const handler = (event: Event) => {
      if ((event as CustomEvent).detail?.outletId === outletId) callback.current();
    };
    window.addEventListener('staff-order-update', handler);
    return () => window.removeEventListener('staff-order-update', handler);
  }, [outletId]);
}
