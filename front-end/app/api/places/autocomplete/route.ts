import { NextRequest, NextResponse } from 'next/server';

const PLACES_AUTOCOMPLETE_ENDPOINT = 'https://places.googleapis.com/v1/places:autocomplete';

type SuggestionPayload = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
};

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const input = (searchParams.get('input') ?? '').trim();
  const sessionToken = (searchParams.get('sessionToken') ?? '').trim();

  const originLat = parseFloat(searchParams.get('originLat') ?? '');
  const originLng = parseFloat(searchParams.get('originLng') ?? '');

  if (!input) {
    return NextResponse.json({ suggestions: [] });
  }

  if (!sessionToken) {
    return NextResponse.json(
      { success: false, error: 'Missing sessionToken parameter' },
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

  const body: Record<string, unknown> = {
    input,
    sessionToken,
    languageCode: 'en',
    includedPrimaryTypes: ['street_address', 'premise', 'plus_code'],
  };

  if (Number.isFinite(originLat) && Number.isFinite(originLng)) {
    body.locationBias = {
      circle: {
        center: {
          latitude: originLat,
          longitude: originLng,
        },
        radius: 50000,
      },
    };
  }

  try {
    const response = await fetch(PLACES_AUTOCOMPLETE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'suggestions.placePrediction.placeId,' +
          'suggestions.placePrediction.text,' +
          'suggestions.placePrediction.structuredFormat.mainText,' +
          'suggestions.placePrediction.structuredFormat.secondaryText',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const payload: SuggestionPayload = (await response.json().catch(() => ({}))) as SuggestionPayload;

    if (!response.ok) {
      const errorMessage =
        (payload as { error?: { message?: string } })?.error?.message ??
        (payload as { errorMessage?: string })?.errorMessage ??
        'Autocomplete request failed';

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        },
        { status: response.status }
      );
    }

    const suggestions =
      payload?.suggestions
        ?.map((item) => {
          const placeId = item.placePrediction?.placeId;
          if (!placeId) {
            return undefined;
          }

          const primary =
            item.placePrediction?.structuredFormat?.mainText?.text ??
            item.placePrediction?.text?.text ??
            '';
          const secondary = item.placePrediction?.structuredFormat?.secondaryText?.text ?? '';

          return {
            placeId,
            primaryText: primary,
            secondaryText: secondary,
          };
        })
        .filter((suggestion): suggestion is { placeId: string; primaryText: string; secondaryText: string } =>
          Boolean(suggestion && suggestion.primaryText && typeof suggestion.secondaryText === "string")
        ) ?? [];

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Places autocomplete failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Autocomplete request failed' },
      { status: 500 }
    );
  }
}


