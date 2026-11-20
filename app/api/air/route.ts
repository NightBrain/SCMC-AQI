import { getAirService } from '@/lib/air-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await getAirService().get();
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
