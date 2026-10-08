import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/server/db/prisma';
import { signToken } from '@/server/auth/jwt';
import { SubscriptionService } from '@/server/services/subscription.service';
import { trialEndDate, TRIAL_DAYS } from '@/server/services/trial.service';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_SIGNUPS_PER_HOUR = 30; // global brake against scripted abuse
const ipHits = new Map<string, number[]>();

function ipLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  hits.push(now);
  ipHits.set(ip, hits);
  if (ipHits.size > 5000) ipHits.clear();
  return hits.length > 5;
}

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'restaurant';
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get('origin');
    if (req.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== new URL(req.url).origin)) {
      return NextResponse.json({ success: false, error: 'Cross-origin request denied.' }, { status: 403 });
    }
    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    if (ipLimited(ip)) {
      return NextResponse.json({ success: false, error: 'Too many sign-up attempts. Try again later.' }, { status: 429 });
    }

    const body = await req.json();
    const restaurantName = typeof body.restaurantName === 'string' ? body.restaurantName.trim() : '';
    const ownerName = typeof body.ownerName === 'string' ? body.ownerName.trim() : '';
    const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 20) : undefined;

    if (restaurantName.length < 2 || restaurantName.length > 80) return NextResponse.json({ success: false, error: 'Enter your restaurant name (2-80 characters).' }, { status: 400 });
    if (ownerName.length < 2 || ownerName.length > 80) return NextResponse.json({ success: false, error: 'Enter your name (2-80 characters).' }, { status: 400 });
    if (!EMAIL_RE.test(email) || email.length > 254) return NextResponse.json({ success: false, error: 'Enter a valid email address.' }, { status: 400 });
    if (password.length < 10 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return NextResponse.json({ success: false, error: 'Password must be 10-72 characters with at least one letter and one number.' }, { status: 400 });
    }

    const recent = await prisma.restaurant.count({ where: { createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } });
    if (recent >= MAX_SIGNUPS_PER_HOUR) return NextResponse.json({ success: false, error: 'Sign-ups are busy. Try again later.' }, { status: 429 });

    // Login resolves a user by email alone, so an email can belong to only one account.
    const existing = await prisma.user.findFirst({ where: { email }, select: { id: true } });
    if (existing) return NextResponse.json({ success: false, error: 'An account with this email already exists. Sign in instead.' }, { status: 409 });

    let plan = await prisma.plan.findUnique({ where: { code: 'PRO' } });
    if (!plan) {
      await SubscriptionService.seedStandardPlans();
      plan = await prisma.plan.findUnique({ where: { code: 'PRO' } });
    }
    if (!plan) throw new Error('plan missing');

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const restaurant = await tx.restaurant.create({ data: { name: restaurantName, slug: slugify(restaurantName), email, phone } });
      const outlet = await tx.outlet.create({ data: { restaurantId: restaurant.id, name: 'Main Branch', code: 'MAIN', isDefault: true } });
      const user = await tx.user.create({ data: { restaurantId: restaurant.id, email, passwordHash, name: ownerName, role: 'OWNER', phone } });
      await tx.userOutlet.create({ data: { userId: user.id, outletId: outlet.id } });
      await tx.subscription.create({ data: { restaurantId: restaurant.id, planId: plan!.id, status: 'TRIALING', currentPeriodStart: now, currentPeriodEnd: trialEndDate(now) } });
      return { restaurant, outlet, user };
    });

    const token = signToken({
      userId: result.user.id,
      restaurantId: result.restaurant.id,
      role: result.user.role,
      email: result.user.email,
      name: result.user.name,
      outletId: result.outlet.id,
    });
    const response = NextResponse.json({ success: true, trialDays: TRIAL_DAYS, user: { role: result.user.role, restaurantName: result.restaurant.name } }, { status: 201 });
    response.cookies.set('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 12 * 60 * 60 });
    return response;
  } catch {
    return NextResponse.json({ success: false, error: 'Sign-up could not be completed.' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
