import { createAirService } from '@/lib/air-server';

export const dynamic = 'force-dynamic';

const service = createAirService();

export async function GET() {
  const result = await service.get();
  if (!result) {
    return Response.json(
      { status: 'error' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (result.stale) headers['X-Air-Stale'] = '1';
  return Response.json(result.payload, { headers });
}
