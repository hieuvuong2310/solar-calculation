import { NextRequest, NextResponse } from 'next/server';
import { fromArrayBuffer } from 'geotiff';

const SOLAR_API_BASE = 'https://solar.googleapis.com/v1';
const EARTH_RADIUS = 6378137;
const DEG_PER_RAD = 180 / Math.PI;
const PANEL_LENGTH_METERS = 3.2;
const PANEL_SPACING_BUFFER_METERS = 0.6;
const PANEL_SPACING_METERS = PANEL_LENGTH_METERS + PANEL_SPACING_BUFFER_METERS;

interface RoofSegmentSummary {
  planeIndex?: number;
  planeKey?: string;
  azimuthDegrees?: number;
  pitchDegrees?: number;
  planeAreaMeters2?: number;
  buildableAreaMeters2?: number;
  planeHeightMeters?: number;
}

interface PanelLocation {
  lat: number;
  lng: number;
  value?: number;
  planeIndex?: number;
  azimuthDegrees?: number;
  pitchDegrees?: number;
  heightMeters?: number;
}

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

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function generatePanelLocationsFromRoofStats(
  stats: unknown,
  lat: number,
  lng: number,
  maxPanels: number
): PanelLocation[] {
  if (!Array.isArray(stats)) {
    return [];
  }

  const locations: PanelLocation[] = [];

  for (const stat of stats) {
    if (!stat || typeof stat !== 'object') {
      continue;
    }

    const planeIndex =
      parseNumber((stat as { planeIndex?: number }).planeIndex) ??
      parseNumber((stat as { segmentIndex?: number }).segmentIndex) ??
      parseNumber((stat as { roofSegmentIndex?: number }).roofSegmentIndex);

    const azimuthDegrees =
      parseNumber((stat as { azimuthDegrees?: number }).azimuthDegrees) ??
      parseNumber((stat as { stats?: { azimuthDegrees?: number } }).stats?.azimuthDegrees);

    const pitchDegrees =
      parseNumber((stat as { pitchDegrees?: number }).pitchDegrees) ??
      parseNumber((stat as { stats?: { pitchDegrees?: number } }).stats?.pitchDegrees);

    const heightMeters =
      parseNumber((stat as { planeHeightMeters?: number }).planeHeightMeters) ??
      parseNumber((stat as { planeHeightAtCenterMeters?: number }).planeHeightAtCenterMeters);

    const boundingBox = (stat as { boundingBox?: unknown }).boundingBox;
    const center = (stat as { center?: { latitude?: number; longitude?: number } }).center;

    if (
      !boundingBox ||
      typeof boundingBox !== 'object' ||
      !(boundingBox as { sw?: unknown }).sw ||
      !(boundingBox as { ne?: unknown }).ne
    ) {
      continue;
    }

    const sw = (boundingBox as { sw: { latitude?: number; longitude?: number } }).sw;
    const ne = (boundingBox as { ne: { latitude?: number; longitude?: number } }).ne;

    const swLat = parseNumber(sw?.latitude) ?? parseNumber(center?.latitude) ?? lat;
    const swLng = parseNumber(sw?.longitude) ?? parseNumber(center?.longitude) ?? lng;
    const neLat = parseNumber(ne?.latitude) ?? parseNumber(center?.latitude) ?? lat;
    const neLng = parseNumber(ne?.longitude) ?? parseNumber(center?.longitude) ?? lng;

    if (
      !Number.isFinite(swLat) ||
      !Number.isFinite(swLng) ||
      !Number.isFinite(neLat) ||
      !Number.isFinite(neLng) ||
      neLat <= swLat ||
      neLng <= swLng
    ) {
      continue;
    }

    const segmentCenterLat = parseNumber(center?.latitude) ?? (swLat + neLat) / 2;
    const { metersPerDegLat, metersPerDegLng } = metersPerDegree(segmentCenterLat);

    const latDelta = neLat - swLat;
    const lngDelta = neLng - swLng;

    const latMeters = Math.max(0, latDelta * metersPerDegLat);
    const lngMeters = Math.max(0, lngDelta * metersPerDegLng);

    if (latMeters === 0 || lngMeters === 0) {
      continue;
    }

    const rows = Math.max(1, Math.floor(latMeters / PANEL_SPACING_METERS));
    const cols = Math.max(1, Math.floor(lngMeters / PANEL_SPACING_METERS));

    const latStep = rows > 0 ? latDelta / rows : latDelta;
    const lngStep = cols > 0 ? lngDelta / cols : lngDelta;

    for (let row = 0; row < rows; row++) {
      const rowLat = swLat + latStep * (row + 0.5);

      for (let col = 0; col < cols; col++) {
        const colLng = swLng + lngStep * (col + 0.5);

        if (
          !Number.isFinite(rowLat) ||
          !Number.isFinite(colLng) ||
          rowLat < -90 ||
          rowLat > 90 ||
          colLng < -180 ||
          colLng > 180
        ) {
          continue;
        }

        locations.push({
          lat: rowLat,
          lng: colLng,
          planeIndex: planeIndex ? Math.round(planeIndex) : undefined,
          azimuthDegrees,
          pitchDegrees,
          heightMeters,
        });

        if (maxPanels > 0 && locations.length >= maxPanels) {
          return locations;
        }
      }
    }
  }

  return locations;
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

  const buildingInsightsUrl = `${SOLAR_API_BASE}/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${solarApiKey}`;
  const dataLayerUrl = `${SOLAR_API_BASE}/dataLayers:get?location.latitude=${lat}&location.longitude=${lng}&radiusMeters=${radiusMeters}&requiredQuality=HIGH&exactQualityRequired=true&pixelSizeMeters=0.5&view=FULL_LAYERS&key=${solarApiKey}`;

  try {
    const [buildingResponse, layerResponse] = await Promise.all([
      fetch(buildingInsightsUrl, { headers: { Accept: 'application/json' }, cache: 'no-store' }),
      fetch(dataLayerUrl, { headers: { Accept: 'application/json' }, cache: 'no-store' }),
    ]);

    if (!buildingResponse.ok) {
      const details = await buildingResponse.json().catch(() => undefined);
      return NextResponse.json(
        {
          success: false,
          error: `Building insights request failed (${buildingResponse.status})`,
          details,
        },
        { status: buildingResponse.status }
      );
    }

    if (!layerResponse.ok) {
      const details = await layerResponse.json().catch(() => undefined);
      return NextResponse.json(
        {
          success: false,
          error: `Data layer request failed (${layerResponse.status})`,
          details,
        },
        { status: layerResponse.status }
      );
    }

    const buildingInsight = await buildingResponse.json();
    const layerData = await layerResponse.json();

    const maskUrl =
      layerData.maskUrl ??
      layerData.solarPotential?.maskUrl ??
      layerData.solarPotential?.roofSegmentSummary?.maskUrl ??
      layerData.roofSegmentsMaskUrl ??
      null;

    if (!maskUrl || typeof maskUrl !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Mask URL not present in data layer response',
          buildingInsight,
          dataLayer: layerData,
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
        {
          success: false,
          error: `Failed to download mask GeoTIFF (${maskResponse.status})`,
        },
        { status: maskResponse.status }
      );
    }

    const maskArrayBuffer = await maskResponse.arrayBuffer();
    const tiff = await fromArrayBuffer(maskArrayBuffer);
    const image = await tiff.getImage();

    const samplesPerPixel =
      typeof (image as { getSamplesPerPixel?: () => number }).getSamplesPerPixel === 'function'
        ? (image as { getSamplesPerPixel: () => number }).getSamplesPerPixel()
        : 1;
    const rasterData = (await image.readRasters({ interleave: true })) as unknown as ArrayLike<number>;
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

    const originLon = origin?.[0] ?? lng;
    const originLat = origin?.[1] ?? lat;

    const segmentSummaries: RoofSegmentSummary[] = Array.isArray(
      buildingInsight?.solarPotential?.roofSegmentSummaries
    )
      ? buildingInsight.solarPotential.roofSegmentSummaries
      : [];
    const roofSegmentStats = Array.isArray(buildingInsight?.solarPotential?.roofSegmentStats)
      ? buildingInsight.solarPotential.roofSegmentStats
      : Array.isArray(layerData?.solarPotential?.roofSegmentSummaries)
      ? layerData.solarPotential.roofSegmentSummaries
      : [];

    const segmentByIndex = new Map<number, RoofSegmentSummary>();
    const segmentByKey = new Map<string, RoofSegmentSummary>();
    let fallbackSegment: RoofSegmentSummary | undefined;

    for (const summary of segmentSummaries) {
      const planeIndex = parseNumber(summary.planeIndex);
      const planeKey = typeof summary.planeKey === 'string' ? summary.planeKey : undefined;

      if (!fallbackSegment) {
        fallbackSegment = summary;
      } else {
        const currentArea = parseNumber(fallbackSegment.buildableAreaMeters2 ?? fallbackSegment.planeAreaMeters2) ?? 0;
        const newArea = parseNumber(summary.buildableAreaMeters2 ?? summary.planeAreaMeters2) ?? 0;
        if (newArea > currentArea) {
          fallbackSegment = summary;
        }
      }

      if (typeof planeIndex === 'number') {
        segmentByIndex.set(Math.round(planeIndex), summary);
      }
      if (planeKey) {
        segmentByKey.set(planeKey, summary);
      }
    }

    const panelLocations: PanelLocation[] = [];

    for (let row = 0; row < height; row += strideY) {
      for (let col = 0; col < width; col += strideX) {
        const index = row * width + col;
        const base = index * samplesPerPixel;
        let value = rasterData[base] ?? 0;
        if (samplesPerPixel > 1) {
          const g = rasterData[base + 1] ?? 0;
          const b = rasterData[base + 2] ?? 0;
          const a = samplesPerPixel > 3 ? rasterData[base + 3] ?? 0 : 0;
          value = value + g * 256 + b * 65536 + a * 16777216;
        }
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
          !Number.isFinite(cellLat) ||
          !Number.isFinite(cellLon) ||
          cellLat < -90 ||
          cellLat > 90 ||
          cellLon < -180 ||
          cellLon > 180
        ) {
          continue;
        }

        const segmentIndex = Math.round(value);
        let segment: RoofSegmentSummary | undefined = segmentByIndex.get(segmentIndex);
        if (!segment && segmentByKey.size > 0) {
          segment = segmentByKey.get(String(value));
        }
        if (!segment) {
          segment = fallbackSegment;
        }

        panelLocations.push({
          lat: cellLat,
          lng: cellLon,
          value,
          planeIndex: Number.isFinite(segmentIndex) ? segmentIndex : undefined,
          azimuthDegrees: segment?.azimuthDegrees,
          pitchDegrees: segment?.pitchDegrees,
          heightMeters: parseNumber(segment?.planeHeightMeters),
        });
      }
    }

    if (panelLocations.length === 0 && roofSegmentStats.length > 0) {
      const fallbackLocations = generatePanelLocationsFromRoofStats(roofSegmentStats, lat, lng, maxPanels);
      if (fallbackLocations.length > 0) {
        panelLocations.push(...fallbackLocations);
      }
    }

    if (panelLocations.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No viable roof segments found for the given location',
          buildingInsight,
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
          panelLocations,
          maskUrl,
          solarData: layerData,
        },
        { status: 404 }
      );
    }

    panelLocations.sort((a, b) => {
      const distA = (a.lat - lat) ** 2 + (a.lng - lng) ** 2;
      const distB = (b.lat - lat) ** 2 + (b.lng - lng) ** 2;
      return distA - distB;
    });

    const limitedLocations = maxPanels > 0 ? panelLocations.slice(0, maxPanels) : panelLocations;

    return NextResponse.json({
      success: true,
      maskUrl,
      panelLocations: limitedLocations,
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
      buildingInsight,
      solarData: layerData,
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
