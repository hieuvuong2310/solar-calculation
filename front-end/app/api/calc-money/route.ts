import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_BACKEND_URL = 'http://localhost:3001/';

function getBackendBaseUrl(): string {
  const envUrl = process.env.BACKEND_BASE_URL ?? process.env.BACKEND_URL;
  if (!envUrl) {
    return DEFAULT_BACKEND_URL;
  }
  return envUrl.endsWith('/') ? envUrl : `${envUrl}/`;
}

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const body = (parsed ?? {}) as Record<string, unknown>;
  const latitude = Number(body.latitude ?? body.lat);
  const longitude = Number(body.longitude ?? body.lng);
  const address =
    typeof body.address === 'string' && body.address.trim().length > 0 ? body.address.trim() : '';

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json(
      { success: false, error: 'Latitude and longitude must be valid numbers' },
      { status: 400 }
    );
  }

  const backendUrl = getBackendBaseUrl();

  try {
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        address,
        latitude,
        longitude,
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Backend responded with status ${response.status}`,
        },
        { status: 502 }
      );
    }

    const payload = await response.json().catch(() => null);
    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown backend error',
      },
      { status: 500 }
    );
  }
}

