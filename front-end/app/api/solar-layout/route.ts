import { NextRequest, NextResponse } from 'next/server';

const SOLAR_API_BASE = 'https://solar.googleapis.com/v1';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const latParam = searchParams.get('lat') ?? searchParams.get('latitude');
  const lngParam = searchParams.get('lng') ?? searchParams.get('longitude');

  const lat = latParam ? parseFloat(latParam) : NaN;
  const lng = lngParam ? parseFloat(lngParam) : NaN;

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid or missing latitude/longitude',
      },
      { status: 400 }
    );
  }

  const apiKey = process.env.GOOGLE_SOLAR_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'Missing GOOGLE_SOLAR_API_KEY environment variable',
      },
      { status: 500 }
    );
  }
  const url = `${SOLAR_API_BASE}/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${apiKey}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => undefined);

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Building insights request failed (${response.status})`,
          details: payload,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error('buildingInsights proxy failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
