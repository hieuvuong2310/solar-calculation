import { NextResponse } from 'next/server';

const DEFAULT_BACKEND_URL = 'http://localhost:3001/';

function getBackendBaseUrl(): string {
  const envUrl = process.env.BACKEND_BASE_URL ?? process.env.BACKEND_URL;
  if (!envUrl) {
    return DEFAULT_BACKEND_URL;
  }
  return envUrl.endsWith('/') ? envUrl : `${envUrl}/`;
}

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const backendUrl = getBackendBaseUrl();
  try {
    const response = await fetch(backendUrl, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    console.log('response', response);
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

