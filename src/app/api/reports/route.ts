import { protectRead } from '@/server/services/api-validation';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { ReportService } from '@/server/services/report.service';

async function handleGET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'view:reports');
  if (errorResponse || !auth) return errorResponse;

  const url = new URL(req.url);
  const type = url.searchParams.get('type') || 'sales';
  const filter = url.searchParams.get('filter') || '7days';
  const customStart = url.searchParams.get('startDate') || undefined;
  const customEnd = url.searchParams.get('endDate') || undefined;
  const format = url.searchParams.get('format') || 'json';

  const report = await ReportService.generateReport(
    type,
    auth.restaurantId,
    auth.outletId,
    filter,
    customStart,
    customEnd
  );

  if (format === 'csv') {
    const csvContent = ReportService.convertToCSV(report.headers, report.rows);
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${type}_report_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ success: true, ...report });
}

export const dynamic = 'force-dynamic';

export const GET = protectRead(handleGET);
