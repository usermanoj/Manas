import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: 'prototype',
    ai_provider: 'mock',
    routes: [
      'POST /api/check-ins',
      'POST /api/check-ins/[id]/messages',
      'POST /api/check-ins/[id]/complete',
      'POST /api/check-ins/[id]/confirm',
      'GET  /api/health',
    ],
  });
}
