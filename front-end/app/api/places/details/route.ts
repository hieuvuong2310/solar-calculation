import { NextRequest, NextResponse } from 'next/server';

const PLACES_DETAILS_ENDPOINT = 'https://places.googleapis.com/v1/places';

interface PlaceDetailsPayload {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const placeId = (searchParams.get('placeId') ?? '').trim();
  const sessionToken = (searchParams.get('sessionToken') ?? '').trim();

  if (!placeId) {
    return NextResponse.json(
      { success: false, error: 'Missing placeId parameter' },
      { status: 400 }
    );
  }

  const apiKey =
    process.env.GOOGLE_PLACES_API_KEY ??
    process.env.GOOGLE_SOLAR_API_KEY ??
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'Missing Google Places API key in environment' },
      { status: 500 }
    );
  }

  const url = new URL(`${PLACES_DETAILS_ENDPOINT}/${encodeURIComponent(placeId)}`);
  if (sessionToken) {
    url.searchParams.set('sessionToken', sessionToken);
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location',
      },
      cache: 'no-store',
    });

    const payloadRaw = await response.json().catch(() => ({}));
    const payload = payloadRaw as PlaceDetailsPayload;

    if (!response.ok) {
      const errorMessage =
        (payload as unknown as { error?: { message?: string } })?.error?.message ??
        'Places details request failed';

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        },
        { status: response.status }
      );
    }

    const place = {
      placeId: payload.id ?? placeId,
      name: payload.displayName?.text,
      formattedAddress: payload.formattedAddress,
      location: payload.location,
    };

    return NextResponse.json({ place });
  } catch (error) {
    console.error('Places details failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Places details request failed' },
      { status: 500 }
    );
  }
}


