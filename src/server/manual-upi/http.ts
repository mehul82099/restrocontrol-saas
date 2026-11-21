import { NextResponse } from 'next/server';
import { ApiError } from './types';

export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function jsonBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > 4096) throw new ApiError(413, 'Request too large.');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, 'Invalid JSON body.');
  }
}

/** Wrap a route handler: maps ApiError -> JSON error responses. */
export async function respond(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (e: unknown) {
    if (e instanceof ApiError) return json({ success: false, error: e.message }, e.status);
    console.error('[manual-upi] unhandled error:', e);
    return json({ success: false, error: 'Internal error.' }, 500);
  }
}
