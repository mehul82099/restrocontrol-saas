import { prisma } from '../db/prisma';
import { AnalyticsService } from './analytics.service';
import { InventoryService } from './inventory.service';
import { MovementType, OrderStatus } from '@prisma/client';

export class ReportService {
  /**
   * Generates formatted data and CSV output for any of the 20 restaurant reports.
   */
  static async generateReport(
    reportType: string,
    restaurantId: string,
    outletId: string,
    filterString = '7days',
    customStart?: string,
    customEnd?: string
  ): Promise<{title: string; headers: string[]; rows: any[]}> {
    const dateRange = AnalyticsService.parseDateFilter(filterString, customStart, customEnd);
    const { startDate, endDate } = dateRange;

    switch (reportType) {
      case 'sales': {
        const orders = await prisma.order.findMany({
          where: {
            restaurantId,
            outletId,
            createdAt: { gte: startDate, lte: endDate },
            status: { notIn: [OrderStatus.CANCELLED] },
          },
          orderBy: { createdAt: 'desc' },
        });

        const rows = orders.map((o) => ({
          'Order #': o.orderNumber,
          Type: o.orderType,
          Status: o.status,
          Payment: o.paymentStatus,
          Subtotal: o.subtotal,
          Discount: o.discountAmount,
          Tax: o.taxAmount,
          Total: o.totalAmount,
          Date: o.createdAt.toISOString().slice(0, 10),
        }));

        return { title: 'Sales Report', headers: Object.keys(rows[0] || {}), rows };
      }

      case 'item_sales': {
        const items = await prisma.orderItem.findMany({
          where: {
            order: {
              restaurantId,
              outletId,
              createdAt: { gte: startDate, lte: endDate },
              status: { notIn: [OrderStatus.CANCELLED] },
            },
          },
          include: { menuItem: { include: { category: true } } },
        });

        const aggregated = new Map<string, { name: string; category: string; quantity: number; revenue: number }>();
        for (const item of items) {
          const existing = aggregated.get(item.menuItemId) || {
            name: item.name,
            category: item.menuItem?.category?.name || 'General',
            quantity: 0,
            revenue: 0,
          };
          existing.quantity += item.quantity;
          existing.revenue += item.totalPrice;
          aggregated.set(item.menuItemId, existing);
        }

        const rows = Array.from(aggregated.values()).map((r) => ({
          'Item Name': r.name,
          Category: r.category,
          'Quantity Sold': r.quantity,
          'Total Revenue (₹)': Math.round(r.revenue * 100) / 100,
        }));

        return { title: 'Item Sales Report', headers: Object.keys(rows[0] || {}), rows };
      }

      case 'current_stock': {
        const stocks = await InventoryService.getOutletStock(restaurantId, outletId);
        const rows = stocks.map((s) => ({
          Ingredient: s.name,
          Category: s.category,
          'Current Stock': `${s.currentStock} ${s.unit}`,
          'Min Stock': `${s.minimumStock} ${s.unit}`,
          'Cost Per Unit (₹)': s.costPerUnit,
          'Total Value (₹)': s.totalValue,
          Status: s.status,
        }));

        return { title: 'Current Stock Report', headers: Object.keys(rows[0] || {}), rows };
      }

      case 'stock_movement': {
        const movements = await prisma.inventoryMovement.findMany({
          where: {
            restaurantId,
            outletId,
            createdAt: { gte: startDate, lte: endDate },
          },
          include: { ingredient: true },
          orderBy: { createdAt: 'desc' },
        });

        const rows = movements.map((m) => ({
          Timestamp: m.createdAt.toISOString().slice(0, 19).replace('T', ' '),
          Ingredient: m.ingredient.name,
          Type: m.movementType,
          Quantity: `${m.quantity} ${m.unit}`,
          'Cost/Unit (₹)': m.costPerUnit,
          'Total Cost (₹)': m.totalCost,
          Reference: `${m.referenceType || ''} ${m.referenceId || ''}`,
          Reason: m.reason || '',
        }));

        return { title: 'Stock Movement Ledger Report', headers: Object.keys(rows[0] || {}), rows };
      }

      case 'inventory_variance': {
        const variance = await AnalyticsService.getExpectedVsActualConsumption(restaurantId, outletId, dateRange);
        const rows = variance.items.map((v) => ({
          Ingredient: v.ingredientName,
          'Expected (Recipe)': `${v.expected} ${v.unit}`,
          'Actual (Ledger)': `${v.actual} ${v.unit}`,
          'Variance Qty': `${v.variance > 0 ? '+' : ''}${v.variance} ${v.unit}`,
          'Variance %': `${v.variancePercent}%`,
          'Variance Value (₹)': v.varianceCost,
          Status: v.status,
          'Operational Explanation': v.explanations.join('; '),
        }));

        return { title: 'Inventory Variance Report (Expected vs Actual)', headers: Object.keys(rows[0] || {}), rows };
      }

      case 'food_cost': {
        const fc = await AnalyticsService.getFoodCostAnalysis(restaurantId);
        const rows = fc.map((item) => ({
          'Menu Item': item.name,
          Category: item.category,
          'Selling Price (₹)': item.sellingPrice,
          'Recipe Cost (₹)': item.recipeCost,
          'Food Cost %': `${item.foodCostPercentage}%`,
          'Gross Margin (₹)': item.grossContribution,
          Status: item.marginStatus,
        }));

        return { title: 'Food Cost & Margin Analysis Report', headers: Object.keys(rows[0] || {}), rows };
      }

      case 'wastage': {
        const wastages = await prisma.wastage.findMany({
          where: {
            restaurantId,
            outletId,
            createdAt: { gte: startDate, lte: endDate },
          },
          include: { ingredient: true },
          orderBy: { createdAt: 'desc' },
        });

        const rows = wastages.map((w) => ({
          Date: w.createdAt.toISOString().slice(0, 10),
          Ingredient: w.ingredient.name,
          Quantity: `${w.quantity} ${w.unit}`,
          'Total Value (₹)': w.totalCost,
          Reason: w.reason,
          Status: w.status,
          Notes: w.notes || '',
        }));

        return { title: 'Wastage Report', headers: Object.keys(rows[0] || {}), rows };
      }

      case 'purchases': {
        const purchases = await prisma.purchaseOrder.findMany({
          where: {
            restaurantId,
            outletId,
            createdAt: { gte: startDate, lte: endDate },
          },
          include: { supplier: true },
          orderBy: { createdAt: 'desc' },
        });

        const rows = purchases.map((p) => ({
          'PO #': p.poNumber,
          Supplier: p.supplier.name,
          Subtotal: p.subtotal,
          Tax: p.taxAmount,
          Total: p.totalAmount,
          Status: p.status,
          Date: p.createdAt.toISOString().slice(0, 10),
        }));

        return { title: 'Purchase Orders Report', headers: Object.keys(rows[0] || {}), rows };
      }

      case 'category_sales': {
        const items = await prisma.orderItem.findMany({where: {order: {restaurantId, outletId, createdAt: {gte: startDate, lte: endDate}, status: {notIn: ['CANCELLED','REFUNDED']}}}, include: {menuItem: {include: {category: true}}}});
        const groups = new Map<string, any>();
        for (const item of items) {const name = item.menuItem.category.name; const g = groups.get(name) || {Category: name, Quantity: 0, Revenue: 0}; g.Quantity += item.quantity; g.Revenue += item.totalPrice; groups.set(name,g);}
        const rows = [...groups.values()]; return {title: 'Category Sales', headers: ['Category','Quantity','Revenue'], rows};
      }
      case 'payment': {
        const payments = await prisma.payment.groupBy({by: ['paymentMethod','status'], where: {restaurantId, outletId, createdAt: {gte: startDate, lte: endDate}}, _sum: {amount: true}, _count: true});
        const rows = payments.map(p => ({Method: p.paymentMethod, Status: p.status, Count: p._count, Amount: p._sum.amount || 0})); return {title: 'Payment Breakdown', headers: ['Method','Status','Count','Amount'], rows};
      }
      case 'discount':
      case 'cancellation': {
        const orders = await prisma.order.findMany({where: {restaurantId, outletId, createdAt: {gte: startDate, lte: endDate}, ...(reportType === 'discount' ? {discountAmount: {gt: 0}} : {status: {in: ['CANCELLED','REFUNDED']}})}, orderBy: {createdAt: 'desc'}});
        const rows = orders.map(o => ({Order: o.orderNumber, Status: o.status, Discount: o.discountAmount, Total: o.totalAmount, Reason: reportType === 'discount' ? o.discountReason || '' : o.cancellationReason || o.notes || ''})); return {title: reportType === 'discount' ? 'Discounts' : 'Cancellations and Refunds', headers: ['Order','Status','Discount','Total','Reason'], rows};
      }
      case 'consumption': return this.generateReport('inventory_variance', restaurantId, outletId, filterString, customStart, customEnd);
      case 'recipe_costing':
      case 'item_margin': return this.generateReport('food_cost', restaurantId, outletId, filterString, customStart, customEnd);
      case 'stock_adjustments': {
        const movements = await prisma.inventoryMovement.findMany({where: {restaurantId,outletId,createdAt:{gte:startDate,lte:endDate},movementType:{in:['ADJUSTMENT','STOCK_COUNT']}},include:{ingredient:true},orderBy:{createdAt:'desc'}});
        const rows=movements.map(m=>({Date:m.createdAt.toISOString(),Ingredient:m.ingredient.name,Quantity:m.quantity,Unit:m.unit,Value:m.totalCost,Reason:m.reason||''}));return {title:'Stock Adjustments',headers:['Date','Ingredient','Quantity','Unit','Value','Reason'],rows};
      }
      case 'low_stock': {
        const stock=await InventoryService.getOutletStock(restaurantId,outletId);
        const rows=stock.filter(s=>s.currentStock<=s.reorderLevel).map(s=>({Ingredient:s.name,Stock:s.currentStock,Unit:s.unit,Minimum:s.minimumStock,Reorder:s.reorderLevel,Status:s.status}));return {title:'Low Stock',headers:['Ingredient','Stock','Unit','Minimum','Reorder','Status'],rows};
      }
      case 'physical_stock': {
        const counts=await prisma.stockCount.findMany({where:{restaurantId,outletId,createdAt:{gte:startDate,lte:endDate}},include:{items:{include:{ingredient:true}}},orderBy:{createdAt:'desc'}});
        const rows=counts.flatMap(c=>c.items.map(i=>({Count:c.countNumber,Status:c.status,Ingredient:i.ingredient.name,System:i.systemStock,Physical:i.physicalStock,Variance:i.variance,Value:i.varianceValue})));return {title:'Physical Stock Audits',headers:['Count','Status','Ingredient','System','Physical','Variance','Value'],rows};
      }
      case 'supplier': {
        const purchases=await prisma.purchaseOrder.findMany({where:{restaurantId,outletId,createdAt:{gte:startDate,lte:endDate},status:{not:'CANCELLED'}},include:{supplier:true}});
        const groups=new Map<string,any>();for(const p of purchases){const g=groups.get(p.supplierId)||{Supplier:p.supplier.name,Orders:0,Amount:0};g.Orders++;g.Amount+=p.totalAmount;groups.set(p.supplierId,g);}return {title:'Supplier Procurement',headers:['Supplier','Orders','Amount'],rows:[...groups.values()]};
      }
      case 'purchase_price_history': {
        const movements=await prisma.inventoryMovement.findMany({where:{restaurantId,outletId,createdAt:{gte:startDate,lte:endDate},movementType:'PURCHASE'},include:{ingredient:true},orderBy:{createdAt:'desc'}});
        const rows=movements.map(m=>({Date:m.createdAt.toISOString(),Ingredient:m.ingredient.name,Quantity:m.quantity,Unit:m.unit,Price:m.costPerUnit,Total:m.totalCost}));return {title:'Purchase Price History',headers:['Date','Ingredient','Quantity','Unit','Price','Total'],rows};
      }

      default: {
        throw new Error('This report is not implemented.');
      }
    }
  }

  /**
   * Helper to convert report data rows to CSV formatted string.
   */
  static convertToCSV(headers: string[], rows: any[]): string {
    if (!rows || rows.length === 0) return '';
    const headerLine = headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',');
    const dataLines = rows.map((row) =>
      headers
        .map((h) => {
          let val = row[h] !== undefined && row[h] !== null ? String(row[h]) : '';
          if (/^[\s]*[=+@-]/.test(val) && typeof row[h] !== 'number') val = "'" + val;
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(',')
    );

    return [headerLine, ...dataLines].join('\n');
  }
}
