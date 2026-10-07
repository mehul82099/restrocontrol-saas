import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'danger' | 'neutral' | 'normal' | 'low_stock' | 'warning' | 'critical' | 'approved' | 'pending' | 'rejected' | 'outline' | 'info';
  className?: string;
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'normal', className, size = 'sm' }: BadgeProps) {
  const variantStyles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-300',
    neutral: 'bg-slate-50 text-slate-700 border-slate-200',
    normal: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    low_stock: 'bg-amber-50 text-amber-700 border-amber-300 font-semibold',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-300',
    critical: 'bg-rose-50 text-rose-700 border-rose-300 font-semibold',
    approved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    pending: 'bg-blue-50 text-blue-700 border-blue-200',
    rejected: 'bg-rose-100 text-rose-800 border-rose-300',
    outline: 'bg-transparent text-slate-600 border-slate-300',
    info: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  };

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border transition-colors',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
}
