// Access: Public bounded untrusted CSP telemetry; no account data.
import { NextRequest, NextResponse } from 'next/server';
import { readBoundedText, RequestBodyError } from '@/server/services/auth-request-security';

// Public browser telemetry, not an authenticated application-data endpoint.
// CSP reports are attacker-controlled. Never log report bodies, URLs, cookies,
// source snippets or other user data. Bound input and emit only coarse counts.
export async function POST(req: NextRequest) {
  try {
    const type = req.headers.get('content-type')?.split(';')[0].trim();
    if (!['application/csp-report', 'application/reports+json', 'application/json'].includes(type || '')) {
      return new NextResponse(null, {status: 415});
    }
    const body = JSON.parse(await readBoundedText(req, 8192));
    const report = body?.['csp-report'] || (Array.isArray(body) ? body[0]?.body : null);
    if (!report || typeof report !== 'object') return new NextResponse(null, {status: 400});
    // Deliberately bounded vocabulary. Avoid log injection and secret-bearing URLs.
    const directive = report['effective-directive'] || report.effectiveDirective;
    const allowed = new Set(['default-src','script-src','script-src-elem','script-src-attr','style-src','style-src-elem','style-src-attr','img-src','font-src','connect-src','frame-src','form-action','object-src','base-uri','frame-ancestors']);
    console.info('CSP report', allowed.has(directive) ? directive : 'other');
    return new NextResponse(null, {status: 204, headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    return new NextResponse(null, {status: error instanceof RequestBodyError ? error.status : 400});
  }
}
export const dynamic = 'force-dynamic';
