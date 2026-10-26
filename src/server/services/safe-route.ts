import { NextResponse } from 'next/server';
import { RequestBodyError } from './auth-request-security';

// Keep successful responses untouched. Never serialize caught provider/DB errors.
export function safeRoute<T extends (...args: any[]) => Promise<any>>(handler: T): T {
  return (async (...args: Parameters<T>) => {
    try { return await handler(...args); }
    catch (error) {
      if (error instanceof RequestBodyError) return NextResponse.json({success: false, error: 'Request too large.'}, {status: 413});
      return NextResponse.json({success: false, error: 'Request could not be completed.'}, {status: 500});
    }
  }) as T;
}
