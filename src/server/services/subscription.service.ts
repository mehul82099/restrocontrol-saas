import { prisma } from '../db/prisma';
import { SubscriptionStatus } from '@prisma/client';

export class SubscriptionService {
  /**
   * Seed standard plans if not present.
   */
  static async seedStandardPlans() {
    const plans = [
      {
        code: 'STARTER',
        name: 'Starter Plan',
        priceMonthly: 1499,
        priceYearly: 14990,
        maxOutlets: 1,
        maxUsers: 3,
        maxOrdersPerMonth: 1000,
        hasAdvancedReports: false,
        hasAiFeatures: false,
        features: JSON.stringify(['1 Outlet', 'Up to 3 Users', '1,000 Orders/mo', 'POS & KOT', 'Recipe Engine', 'Basic Inventory']),
      },
      {
        code: 'GROWTH',
        name: 'Growth Plan',
        priceMonthly: 2999,
        priceYearly: 29990,
        maxOutlets: 2,
        maxUsers: 8,
        maxOrdersPerMonth: 5000,
        hasAdvancedReports: true,
        hasAiFeatures: false,
        features: JSON.stringify(['2 Outlets', 'Up to 8 Users', '5,000 Orders/mo', 'Full Inventory Ledger', 'Wastage Tracking', 'Variance Analytics']),
      },
      {
        code: 'PRO',
        name: 'Pro Kitchen',
        priceMonthly: 4999,
        priceYearly: 49990,
        maxOutlets: 5,
        maxUsers: 20,
        maxOrdersPerMonth: 20000,
        hasAdvancedReports: true,
        hasAiFeatures: true,
        features: JSON.stringify(['5 Outlets', 'Up to 20 Users', '20,000 Orders/mo', 'Purchase Orders', 'Stock Audits', 'Recipe Food Costing', 'All 20 Reports']),
      },
      {
        code: 'MULTI_OUTLET',
        name: 'Multi-Outlet Enterprise',
        priceMonthly: 9999,
        priceYearly: 99990,
        maxOutlets: 25,
        maxUsers: 100,
        maxOrdersPerMonth: 100000,
        hasAdvancedReports: true,
        hasAiFeatures: true,
        features: JSON.stringify(['25 Outlets', 'Unlimited Staff', '100,000 Orders/mo', 'Central Kitchen Transfers', 'Priority 24/7 SLA', 'Custom Integrations']),
      },
    ];

    for (const plan of plans) {
      await prisma.plan.upsert({
        where: { code: plan.code },
        create: plan,
        update: plan,
      });
    }
  }

  /**
   * Get subscription status and limits for a restaurant.
   */
  static async getRestaurantSubscription(restaurantId: string) {
    const sub = await prisma.subscription.findUnique({
      where: { restaurantId },
      include: { plan: true },
    });

    if (!sub) {
      // Create default Growth plan trial if missing
      let plan = await prisma.plan.findUnique({ where: { code: 'PRO' } });
      if (!plan) {
        await this.seedStandardPlans();
        plan = await prisma.plan.findUnique({ where: { code: 'PRO' } });
      }

      const newSub = await prisma.subscription.create({
        data: {
          restaurantId,
          planId: plan!.id,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
        include: { plan: true },
      });
      return newSub;
    }

    // Check usage
    const [currentOutlets, currentUsers, currentMonthOrders] = await Promise.all([
      prisma.outlet.count({ where: { restaurantId, isActive: true } }),
      prisma.user.count({ where: { restaurantId, isActive: true } }),
      prisma.order.count({
        where: {
          restaurantId,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    return {
      ...sub,
      usage: {
        outlets: { current: currentOutlets, max: sub.plan.maxOutlets },
        users: { current: currentUsers, max: sub.plan.maxUsers },
        ordersThisMonth: { current: currentMonthOrders, max: sub.plan.maxOrdersPerMonth },
      },
    };
  }

  /**
   * Check if a feature is allowed under current subscription.
   */
  static async canPerformAction(
    restaurantId: string,
    action: 'ADD_OUTLET' | 'ADD_USER' | 'CREATE_ORDER' | 'ADVANCED_REPORTS'
  ): Promise<{ allowed: boolean; reason?: string }> {
    const sub = (await this.getRestaurantSubscription(restaurantId)) as any;
    if (sub.status !== SubscriptionStatus.ACTIVE && sub.status !== SubscriptionStatus.TRIALING) {
      return { allowed: false, reason: 'Subscription is inactive or expired.' };
    }

    if (action === 'ADD_OUTLET' && sub.usage.outlets.current >= sub.usage.outlets.max) {
      return { allowed: false, reason: `Plan limit reached: max ${sub.usage.outlets.max} outlets allowed.` };
    }

    if (action === 'ADD_USER' && sub.usage.users.current >= sub.usage.users.max) {
      return { allowed: false, reason: `Plan limit reached: max ${sub.usage.users.max} staff members allowed.` };
    }

    if (action === 'CREATE_ORDER' && sub.usage.ordersThisMonth.current >= sub.usage.ordersThisMonth.max) {
      return { allowed: false, reason: `Monthly order limit reached: ${sub.usage.ordersThisMonth.max} orders allowed.` };
    }

    if (action === 'ADVANCED_REPORTS' && !sub.plan.hasAdvancedReports) {
      return { allowed: false, reason: 'Advanced reports are not available on your current plan.' };
    }

    return { allowed: true };
  }
}
