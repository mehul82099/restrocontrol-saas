import { NextRequest, NextResponse } from 'next/server';
import { assertTenantReference } from './validation';
import { prisma } from '../db/prisma';
import { authenticateRequest } from '../auth/middleware';

// All mutating JSON routes share bounded, tenant-scoped validation and safe error handling.
export function protectMutation(handler: (req: NextRequest, ...args: any[]) => any) {
  return async (req: NextRequest, ...args: any[]) => {
    try {
      const {auth, errorResponse} = await authenticateRequest(req);
      if (!auth) return errorResponse;
      const text = await req.clone().text();
      if (text.length > 65536) return NextResponse.json({success: false, error: 'Request too large.'}, {status: 413});
      const data = JSON.parse(text || '{}');
      if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Invalid request');
      const numericKeys = new Set(['quantity','physicalStock','basePrice','price','costPerUnit','minimumStock','reorderLevel','yieldQuantity','wastePercentage','unitPrice','totalPrice','subtotal','discountAmount','taxAmount','deliveryFee','tipAmount','totalAmount','amount','taxRate','capacity','prepTimeMinutes','sortOrder']);
      function bounds(obj: any, depth = 0) {
        if (depth > 8) throw new Error('Invalid request');
        for (const [key, value] of Object.entries(obj)) {
          if (numericKeys.has(key) && value !== null && value !== '') {
            if (!['number','string'].includes(typeof value) || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 1e9) {
              // A signed manual inventory adjustment is the only negative input permitted.
              if (!(key === 'quantity' && new URL(req.url).pathname === '/api/inventory' && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= 1e9)) throw new Error('Invalid numeric value');
            }
            if (['quantity','yieldQuantity','capacity'].includes(key) && Number(value) === 0) throw new Error('Quantity must be positive');
          }
          if (typeof value === 'string' && value.length > 4000) throw new Error('Text too long');
          if (Array.isArray(value)) {if (value.length > 200) throw new Error('Too many items'); value.forEach(v => {if (v && typeof v === 'object') bounds(v,depth+1)});}
          else if (value && typeof value === 'object') bounds(value, depth+1);
        }
      }
      bounds(data);
      const path = new URL(req.url).pathname;
      const refs: Record<string,string> = {categoryId: path === '/api/ingredients' ? 'ingredientCategory' : 'category', preferredSupplierId: 'supplier', supplierId: 'supplier', ingredientId: 'ingredient', menuItemId: 'menuItem', customerId: 'customer', tableId: 'diningTable', purchaseOrderId: 'purchaseOrder'};
      async function validateRefs(obj: any) {
        for (const [key, model] of Object.entries(refs)) if (obj[key]) await assertTenantReference(model, obj[key], auth!.restaurantId, prisma, ['diningTable','purchaseOrder'].includes(model) ? auth!.outletId : undefined);
        if (obj.variantId) {
          const variant = await prisma.menuItemVariant.findFirst({where: {id: obj.variantId, menuItemId: obj.menuItemId, menuItem: {restaurantId: auth!.restaurantId}}});
          if (!variant) throw new Error('Invalid variant');
        }
        if (obj.items) {if (!Array.isArray(obj.items) || !obj.items.length) throw new Error('Items are required'); for (const item of obj.items) await validateRefs(item);}
      }
      await validateRefs(data);
      if (data.outletId && data.outletId !== auth.outletId) throw new Error('Outlet mismatch: select the outlet using x-outlet-id.');
      // Dynamic records must be in the selected outlet as well as this tenant.
      const id = args[0]?.params ? (await args[0].params).id : undefined;
      const model = path.startsWith('/api/orders/') ? 'order' : path.startsWith('/api/kot/') ? 'kitchenOrder' : path.startsWith('/api/wastage/') ? 'wastage' : path.startsWith('/api/stock-count/') ? 'stockCount' : null;
      if (model && id) await assertTenantReference(model, id, auth.restaurantId, prisma, auth.outletId);
      if (args[0]?.params) args[0] = {...args[0], params: await args[0].params};
      const response = await handler(req, ...args);
      if (response && response.status >= 400) return NextResponse.json({success: false, error: response.status >= 500 ? 'Request failed.' : 'Request rejected. Check the input and permissions.'}, {status: response.status});
      return response;
    } catch {
      return NextResponse.json({success: false, error: 'Invalid request or operation could not be completed.'}, {status: 400});
    }
  };
}

export function protectRead(handler: (req: NextRequest, ...args: any[]) => any) {
  return async (req: NextRequest, ...args: any[]) => {
    try {return await handler(req, ...args);} catch {
      return NextResponse.json({success: false, error: 'Request could not be completed.'}, {status: 400});
    }
  };
}
