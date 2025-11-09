import { NextRequest, NextResponse } from 'next/server';
import { fromArrayBuffer } from 'geotiff';

const SOLAR_API_ENDPOINT = 'https://solar.googleapis.com/v1/dataLayers:get';
const EARTH_RADIUS = 6378137;
const DEG_PER_RAD = 180 / Math.PI;
const PANEL_LENGTH_METERS = 3.2;
const PANEL_SPACING_BUFFER_METERS = 0.6;
const PANEL_SPACING_METERS = PANEL_LENGTH_METERS + PANEL_SPACING_BUFFER_METERS;

function metersPerDegree(latitude: number) {
  const metersPerDegLat = (Math.PI / 180) * EARTH_RADIUS;
  const metersPerDegLng = metersPerDegLat * Math.cos((latitude * Math.PI) / 180);
  return { metersPerDegLat, metersPerDegLng };
}

function mercatorToLngLat(x: number, y: number) {
  const lng = (x / EARTH_RADIUS) * DEG_PER_RAD;
  const latRad = 2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2;
  const lat = latRad * DEG_PER_RAD;
  return { lat, lng };
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const lat = parseFloat(searchParams.get('lat') ?? searchParams.get('latitude') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? searchParams.get('longitude') ?? '');
  const maxPanels = parseInt(searchParams.get('panels') ?? '0', 10);
  const solarApiKey = process.env.GOOGLE_SOLAR_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ success: false, error: 'Invalid latitude or longitude' }, { status: 400 });
  }

  if (!solarApiKey) {
    return NextResponse.json({ success: false, error: 'Missing GOOGLE_SOLAR_API_KEY environment variable' }, { status: 500 });
  }

  const radiusMeters = parseFloat(searchParams.get('radius') ?? '120');
  const requestUrl = `${SOLAR_API_ENDPOINT}?location.latitude=${lat}&location.longitude=${lng}&radiusMeters=${radiusMeters}&requiredQuality=HIGH&exactQualityRequired=true&pixelSizeMeters=0.5&view=FULL_LAYERS&key=${solarApiKey}`;

  try {
    const solarResponse = await fetch(requestUrl, {
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!solarResponse.ok) {
      const errorJson = await solarResponse.json().catch(() => undefined);
      return NextResponse.json(
        {
          success: false,
          error: `Solar API error (${solarResponse.status})`,
          details: errorJson,
        },
        { status: solarResponse.status }
      );
    }

    const solarData = await solarResponse.json();
    const maskUrl =
      solarData.maskUrl ??
      solarData.solarPotential?.maskUrl ??
      solarData.solarPotential?.roofSegmentSummary?.maskUrl ??
      solarData.roofSegmentsMaskUrl ??
      null;

    if (!maskUrl || typeof maskUrl !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Mask URL not present in solar API response',
          solarData,
        },
        { status: 502 }
      );
    }

    const formattedMaskUrl = maskUrl.includes('key=') ? maskUrl : `${maskUrl}&key=${solarApiKey}`;
    const maskResponse = await fetch(formattedMaskUrl, {
      headers: { Accept: 'image/tiff, application/octet-stream' },
      cache: 'no-store',
    });

    if (!maskResponse.ok) {
      return NextResponse.json(
        { success: false, error: `Failed to download mask GeoTIFF (${maskResponse.status})` },
        { status: maskResponse.status }
      );
    }

    const maskArrayBuffer = await maskResponse.arrayBuffer();
    const tiff = await fromArrayBuffer(maskArrayBuffer);
    const image = await tiff.getImage();

    const rasterData = (await image.readRasters({ interleave: true })) as { [index: number]: number };
    const width = image.getWidth();
    const height = image.getHeight();
    const origin = image.getOrigin();
    const resolution = image.getResolution();
    const geoKeys = image.getGeoKeys() ?? {};
    const projectedCSType = typeof geoKeys.ProjectedCSTypeGeoKey === 'number' ? geoKeys.ProjectedCSTypeGeoKey : undefined;
    const geographicType = typeof geoKeys.GeographicTypeGeoKey === 'number' ? geoKeys.GeographicTypeGeoKey : undefined;
    const isWebMercator = projectedCSType === 3857;
    const isGeographic = projectedCSType === undefined && (geographicType === 4326 || geographicType === undefined);

    const pixelWidthRaw = resolution?.[0] ?? 0;
    const pixelHeightRaw = resolution?.[1] ?? 0;

    let pixelWidthMeters = 0;
    let pixelHeightMeters = 0;

    if (isWebMercator) {
      pixelWidthMeters = Math.abs(pixelWidthRaw) || PANEL_SPACING_METERS;
      pixelHeightMeters = Math.abs(pixelHeightRaw) || PANEL_SPACING_METERS;
    } else {
      const { metersPerDegLat, metersPerDegLng } = metersPerDegree(lat);
      pixelWidthMeters = Math.abs(pixelWidthRaw) * metersPerDegLng;
      pixelHeightMeters = Math.abs(pixelHeightRaw) * metersPerDegLat;
    }

    const strideX = Math.max(1, Math.round(PANEL_SPACING_METERS / (pixelWidthMeters || PANEL_SPACING_METERS)));
    const strideY = Math.max(1, Math.round(PANEL_SPACING_METERS / (pixelHeightMeters || PANEL_SPACING_METERS)));

    const candidates: Array<{ lat: number; lng: number; value: number }> = [];

    const originLon = origin?.[0] ?? lng;
    const originLat = origin?.[1] ?? lat;

    for (let row = 0; row < height; row += strideY) {
      for (let col = 0; col < width; col += strideX) {
        const index = row * width + col;
        const value = rasterData[index];
        if (!value || value <= 0) {
          continue;
        }

        let cellLat = lat;
        let cellLon = lng;

        if (isWebMercator) {
          const x = originLon + (col + 0.5) * pixelWidthRaw;
          const y = originLat + (row + 0.5) * pixelHeightRaw;
          const result = mercatorToLngLat(x, y);
          cellLat = result.lat;
          cellLon = result.lng;
        } else if (isGeographic) {
          cellLon = originLon + (col + 0.5) * pixelWidthRaw;
          cellLat = originLat + (row + 0.5) * pixelHeightRaw;
        } else {
          continue;
        }

        if (
          Number.isFinite(cellLat) &&
          Number.isFinite(cellLon) &&
          cellLat >= -90 &&
          cellLat <= 90 &&
          cellLon >= -180 &&
          cellLon <= 180
        ) {
          candidates.push({ lat: cellLat, lng: cellLon, value });
        }
      }
    }

    candidates.sort((a, b) => {
      const distA = (a.lat - lat) ** 2 + (a.lng - lng) ** 2;
      const distB = (b.lat - lat) ** 2 + (b.lng - lng) ** 2;
      return distA - distB;
    });

    const limitedPositions = maxPanels > 0 ? candidates.slice(0, maxPanels) : candidates;

    return NextResponse.json({
      success: true,
      maskUrl,
      panelCenters: limitedPositions,
      metadata: {
        width,
        height,
        origin,
        resolution,
        geoKeys,
        strideX,
        strideY,
        pixelWidthMeters,
        pixelHeightMeters,
      },
      solarData,
    });
  } catch (error) {
    console.error('Solar layout API failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
