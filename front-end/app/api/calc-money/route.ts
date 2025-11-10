import { join } from 'node:path';
import { promises as fs } from 'node:fs';
import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_BACKEND_URL = 'http://localhost:3001/';

type SampleResponse = {
  message?: string;
  response?: string;
};

type SampleResponseMap = Record<string, SampleResponse>;

let cachedSamples: SampleResponseMap | null = null;

function getBackendBaseUrl(): string {
  const envUrl = process.env.BACKEND_BASE_URL ?? process.env.BACKEND_URL;
  if (!envUrl) {
    return DEFAULT_BACKEND_URL;
  }
  return envUrl.endsWith('/') ? envUrl : `${envUrl}/`;
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

const ADDRESS_ALIASES: Array<{ match: string; targetKey: string }> = [
  { match: 'tp hồ chí minh', targetKey: 'Vietnam' },
  { match: 'thành phố hồ chí minh', targetKey: 'Vietnam' },
  { match: 'viet nam', targetKey: 'Vietnam' },
  { match: 'việt nam', targetKey: 'Vietnam' },
];

async function loadSampleResponses(): Promise<SampleResponseMap> {
  if (cachedSamples) {
    return cachedSamples;
  }
  const filePath = join(process.cwd(), 'mock', 'sample_response.json');
  try {
    const contents = await fs.readFile(filePath, 'utf8');
    cachedSamples = JSON.parse(contents) as SampleResponseMap;
  } catch {
    cachedSamples = {};
  }
  return cachedSamples ?? {};
}

function resolveSampleResponse(
  samples: SampleResponseMap,
  rawAddress: string,
  coords?: { latitude: number; longitude: number }
): SampleResponse | null {
  if (!samples) {
    return null;
  }
  const normalizedInput = normalizeAddress(rawAddress);
  if (normalizedInput) {
    const exactMatch = samples[normalizedInput];
    if (exactMatch) {
      return exactMatch;
    }
    const aliasMatch = ADDRESS_ALIASES.find(({ match }) => normalizedInput.includes(match));
    if (aliasMatch && samples[aliasMatch.targetKey]) {
      return samples[aliasMatch.targetKey];
    }
    const containsMatchKey = Object.keys(samples).find(
      (key) => key !== 'default' && normalizedInput.includes(normalizeAddress(key))
    );
    if (containsMatchKey && samples[containsMatchKey]) {
      return samples[containsMatchKey];
    }
  }
  if (
    coords &&
    Math.abs(coords.latitude - 10.80667) < 1e-6 &&
    Math.abs(coords.longitude - 106.698238) < 1e-6 &&
    samples.Vietnam
  ) {
    return samples.Vietnam;
  }
  return samples.default ?? null;
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
  const address = typeof body.address === 'string' ? body.address : '';

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json(
      { success: false, error: 'Latitude and longitude must be valid numbers' },
      { status: 400 }
    );
  }

  const samples = await loadSampleResponses();
  const sample = resolveSampleResponse(samples, address, { latitude, longitude });

  if (sample?.response) {
    return NextResponse.json({ success: true, data: sample, sample: true });
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

    const payload = await response.json().catch(() => null);

    if (!response.ok || payload?.success === false) {
      return NextResponse.json(
        {
          success: false,
          error:
            payload?.error ??
            (response.ok ? 'Calculation request failed' : `Backend responded with status ${response.status}`),
          fallback: sample ?? null,
        },
        { status: response.ok ? 502 : response.status }
      );
    }

    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown backend error',
        fallback: sample ?? null,
      },
      { status: 500 }
    );
  }
}
