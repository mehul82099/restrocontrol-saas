import { UserRole } from '@prisma/client';

export type Permission =
  | 'manage:all'
  | 'manage:restaurant'
  | 'manage:outlets'
  | 'manage:users'
  | 'manage:menu'
  | 'manage:recipes'
  | 'manage:ingredients'
  | 'manage:inventory'
  | 'view:inventory'
  | 'manage:purchases'
  | 'manage:suppliers'
  | 'manage:wastage'
  | 'approve:wastage'
  | 'manage:stock_count'
  | 'approve:stock_count'
  | 'access:pos'
  | 'manage:orders'
  | 'cancel:order'
  | 'refund:order'
  | 'access:kot'
  | 'update:kot_status'
  | 'view:analytics'
  | 'view:reports'
  | 'view:food_cost'
  | 'view:variance'
  | 'manage:subscription'
  | 'view:audit_logs';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  OWNER: [
    'manage:all',
    'manage:restaurant',
    'manage:outlets',
    'manage:users',
    'manage:menu',
    'manage:recipes',
    'manage:ingredients',
    'manage:inventory',
    'view:inventory',
    'manage:purchases',
    'manage:suppliers',
    'manage:wastage',
    'approve:wastage',
    'manage:stock_count',
    'approve:stock_count',
    'access:pos',
    'manage:orders',
    'cancel:order',
    'refund:order',
    'access:kot',
    'update:kot_status',
    'view:analytics',
    'view:reports',
    'view:food_cost',
    'view:variance',
    'manage:subscription',
    'view:audit_logs',
  ],
  MANAGER: [
    'manage:menu',
    'manage:recipes',
    'manage:ingredients',
    'manage:inventory',
    'view:inventory',
    'manage:purchases',
    'manage:suppliers',
    'manage:wastage',
    'approve:wastage',
    'manage:stock_count',
    'approve:stock_count',
    'access:pos',
    'manage:orders',
    'cancel:order',
    'refund:order',
    'access:kot',
    'update:kot_status',
    'view:analytics',
    'view:reports',
    'view:food_cost',
    'view:variance',
    'manage:users',
  ],
  CASHIER: [
    'access:pos',
    'manage:orders',
    'view:inventory',
  ],
  KITCHEN_STAFF: [
    'access:kot',
    'update:kot_status',
  ],
  INVENTORY_MANAGER: [
    'manage:ingredients',
    'manage:inventory',
    'view:inventory',
    'manage:purchases',
    'manage:suppliers',
    'manage:wastage',
    'manage:stock_count',
    'view:variance',
    'view:reports',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  if (role === 'OWNER') return true;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission) || permissions.includes('manage:all');
}
