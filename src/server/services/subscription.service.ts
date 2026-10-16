import { prisma } from '../db/prisma';
import { SubscriptionStatus } from '@prisma/client';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription-plans';
import { getTrialInfo, trialEndDate } from './trial.service';

export class SubscriptionService {
  static async seedStandardPlans() {
    for (const plan of SUBSCRIPTION_PLANS) {
      const data = {
        code: plan.code, name: plan.name, priceMonthly: plan.price, priceYearly: null,
        maxOutlets: plan.maxOutlets, maxUsers: plan.maxUsers, maxOrdersPerMonth: plan.maxOrdersPerMonth,
        isAvailable: !plan.upcoming, hasAdvancedReports: !plan.upcoming, hasAiFeatures: false,
        features: JSON.stringify([plan.description, ...(plan.upcoming ? ['Upcoming - unavailable'] : ['POS, inventory, recipes, purchases, stock audits and reports'])]),
      };
      await prisma.plan.upsert({ where: { code: plan.code }, create: data, update: data });
    }
  }

  static async getRestaurantSubscription(restaurantId: string) {
    let sub = await prisma.subscription.findUnique({ where: { restaurantId }, include: { plan: true } });
    if (!sub) {
      // Missing billing state never creates an ACTIVE subscription or a fresh trial.
      await this.seedStandardPlans();
      const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'WEBSITE_SINGLE' } });
      const restaurant = await prisma.restaurant.findUniqueOrThrow({ where: { id: restaurantId }, select: { createdAt: true } });
      sub = await prisma.subscription.upsert({
        where: { restaurantId }, update: {},
        create: { restaurantId, planId: plan.id, status: SubscriptionStatus.TRIALING, currentPeriodStart: restaurant.createdAt, currentPeriodEnd: trialEndDate(restaurant.createdAt) },
        include: { plan: true },
      });
    }
    const [outlets, users, orders] = await Promise.all([
      prisma.outlet.count({ where: { restaurantId, isActive: true } }),
      prisma.user.count({ where: { restaurantId, isActive: true } }),
      prisma.order.count({ where: { restaurantId, createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
    ]);
    return { ...sub, usage: { outlets: { current: outlets, max: sub.plan.maxOutlets }, users: { current: users, max: sub.plan.maxUsers }, ordersThisMonth: { current: orders, max: sub.plan.maxOrdersPerMonth } } };
  }

  static async canPerformAction(restaurantId: string, action: 'ADD_OUTLET' | 'ADD_USER' | 'CREATE_ORDER' | 'ADVANCED_REPORTS'): Promise<{ allowed: boolean; reason?: string }> {
    const sub = await this.getRestaurantSubscription(restaurantId);
    if (!sub.plan.isAvailable || ![SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING].includes(sub.status as any) || getTrialInfo(sub).expired) return { allowed: false, reason: 'Subscription is inactive, expired or unavailable.' };
    const usage = action === 'ADD_OUTLET' ? sub.usage.outlets : action === 'ADD_USER' ? sub.usage.users : action === 'CREATE_ORDER' ? sub.usage.ordersThisMonth : null;
    // null is unlimited. Zero is a hard zero, never mistaken for unlimited.
    if (usage && usage.max !== null && usage.current >= usage.max) return { allowed: false, reason: 'Your plan limit has been reached.' };
    if (action === 'ADVANCED_REPORTS' && !sub.plan.hasAdvancedReports) return { allowed: false, reason: 'Advanced reports are not available on your current plan.' };
    return { allowed: true };
  }
}
