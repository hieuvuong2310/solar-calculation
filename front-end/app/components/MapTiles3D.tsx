'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import type { Layer, LayersList, MapViewState } from '@deck.gl/core';
import DeckGL from '@deck.gl/react';
import { Tile3DLayer } from '@deck.gl/geo-layers';
import { ScenegraphLayer } from '@deck.gl/mesh-layers';
import { registerLoaders } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';
import { DracoLoader } from '@loaders.gl/draco';
import type { Tileset3D } from '@loaders.gl/tiles';

registerLoaders([GLTFLoader, DracoLoader]);

type PlaceSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText?: string;
};

type PlaceDetails = {
  placeId: string;
  name?: string;
  formattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
};

type MapTiles3DProps = {
  apiKey: string;
  height?: string;
  width?: string;
  center?: {
    lat: number;
    lng: number;
  };
};

type DeckState = {
  latitude: number;
  longitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
};

type SolarPanelEntry = {
  center?: {
    latitude?: number;
    longitude?: number;
  };
  orientation?: string;
  segmentIndex?: number;
  yearlyEnergyDcKwh?: number;
};

type RoofSegmentStat = {
  pitchDegrees?: number;
  azimuthDegrees?: number;
  planeHeightAtCenterMeters?: number;
};

type BuildingInsights = {
  name?: string;
  center?: {
    latitude?: number;
    longitude?: number;
  };
  solarPotential?: {
    panelHeightMeters?: number;
    panelWidthMeters?: number;
    solarPanels?: SolarPanelEntry[];
    roofSegmentStats?: RoofSegmentStat[];
    maxArrayPanelsCount?: number;
  };
};

type PanelInstance = {
  position: [number, number, number];
  pitchDeg: number;
  azimuthDeg: number;
  dimensionsMeters: [number, number];
  energy?: number;
};

type CalcMoneyPayload = {
  summary: string;
};

const DEFAULT_LOCATION = {
  lat: 48.5164865,
  lng: -123.36975699999999,
};

const AUTOCOMPLETE_DEBOUNCE_MS = 250;

function generateSessionToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const PANEL_SCALE = 0.65;

function orientationDimensions(
  orientation: string | undefined,
  panelHeight: number,
  panelWidth: number
): [number, number] {
  const scaledHeight = panelHeight * PANEL_SCALE;
  const scaledWidth = panelWidth * PANEL_SCALE;

  if (orientation?.toUpperCase() === 'PORTRAIT') {
    return [scaledHeight, scaledWidth];
  }
  return [scaledWidth, scaledHeight];
}

function createPanelInstancesFromBuilding(data: BuildingInsights | undefined): PanelInstance[] {
  if (!data?.solarPotential?.solarPanels?.length) {
    return [];
  }

  const roofStats = data.solarPotential.roofSegmentStats ?? [];
  const panelHeight = data.solarPotential.panelHeightMeters ?? 1.8;
  const panelWidth = data.solarPotential.panelWidthMeters ?? 1.1;

  const instances: PanelInstance[] = [];

  for (const panel of data.solarPotential.solarPanels) {
    const lat = panel.center?.latitude;
    const lng = panel.center?.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      continue;
    }

    let segment: RoofSegmentStat | undefined;
    if (
      typeof panel.segmentIndex === 'number' &&
      panel.segmentIndex >= 0 &&
      panel.segmentIndex < roofStats.length
    ) {
      segment = roofStats[panel.segmentIndex];
    }
    if (!segment && typeof panel.segmentIndex === 'number') {
      segment = roofStats.find((_, idx) => idx === panel.segmentIndex);
    }

    const pitchDeg = segment?.pitchDegrees ?? 0;
    const azimuthDeg = segment?.azimuthDegrees ?? 0;
    const baseHeight = segment?.planeHeightAtCenterMeters ?? 0;
    const height = baseHeight - 16;

    const [length, width] = orientationDimensions(panel.orientation, panelHeight, panelWidth);

    instances.push({
      position: [lng, lat, height],
      pitchDeg,
      azimuthDeg,
      dimensionsMeters: [length, width],
      energy: panel.yearlyEnergyDcKwh ?? undefined,
    });
  }

  return instances;
}

export default function MapTiles3D({
  apiKey,
  height = '100vh',
  width = '100%',
  center,
}: MapTiles3DProps) {
  const defaultLocation = useMemo(
    () => (center ? { lat: center.lat, lng: center.lng } : DEFAULT_LOCATION),
    [center]
  );
  const initialViewState = useMemo<DeckState>(
    () => ({
      latitude: defaultLocation.lat,
      longitude: defaultLocation.lng,
      zoom: 19.3,
      pitch: 60,
      bearing: 0,
    }),
    [defaultLocation.lat, defaultLocation.lng]
  );

  const [viewState, setViewState] = useState<DeckState>(initialViewState);
  const [targetLocation, setTargetLocation] = useState(defaultLocation);
  const [panelInstances, setPanelInstances] = useState<PanelInstance[]>([]);
  const [panelLimit, setPanelLimit] = useState<number>(12);
  const [maxPanelCapacity, setMaxPanelCapacity] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [placesSessionToken, setPlacesSessionToken] = useState<string>(() => generateSessionToken());
  const autocompleteAbortRef = useRef<AbortController | null>(null);
  const [suppressSuggestions, setSuppressSuggestions] = useState(false);
  const [calcMoneyLoading, setCalcMoneyLoading] = useState(false);
  const [calcMoneyPayload, setCalcMoneyPayload] = useState<CalcMoneyPayload | null>(null);
  const fetchCalcMoney = useCallback(async (coords: { lat: number; lng: number }, addressHint?: string) => {
    setCalcMoneyLoading(true);
    setCalcMoneyPayload(null);

    if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
      setCalcMoneyLoading(false);
      setCalcMoneyPayload({ summary: 'Invalid location coordinates for quote request.' });
      return;
    }

    const extractSummary = (payload: unknown): string => {
      if (!payload) {
        return 'Quote data unavailable.';
      }
      if (typeof payload === 'string') {
        return payload;
      }
      if (typeof payload === 'object') {
        const responseText = (payload as { response?: unknown }).response;
        if (typeof responseText === 'string') {
          return responseText;
        }
        return JSON.stringify(payload, null, 2);
      }
      return String(payload);
    };

    try {
      const response = await fetch('/api/calc-money', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({
          lat: coords.lat,
          lng: coords.lng,
          address: addressHint ?? '',
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.success === false) {
        const summary = extractSummary(payload?.fallback ?? payload?.data ?? payload);
        setCalcMoneyPayload({ summary });
        return;
      }

      const summary = extractSummary(payload?.data ?? payload);
      setCalcMoneyPayload({ summary });
    } catch (err) {
      setCalcMoneyPayload({
        summary: err instanceof Error ? err.message : 'Failed to calculate financial details.',
      });
    } finally {
      setCalcMoneyLoading(false);
    }
  }, []);


  useEffect(() => {
    setTargetLocation(defaultLocation);
    setViewState((prev) => ({
      ...prev,
      latitude: defaultLocation.lat,
      longitude: defaultLocation.lng,
    }));
  }, [defaultLocation]);

  useEffect(() => {
    const trimmed = searchQuery.trim();

    if (trimmed.length < 3) {
      if (autocompleteAbortRef.current) {
        autocompleteAbortRef.current.abort();
        autocompleteAbortRef.current = null;
      }
      setSearchSuggestions([]);
      setSearchMessage(null);
      setSearchLoading(false);
      return;
    }

    if (suppressSuggestions) {
      if (autocompleteAbortRef.current) {
        autocompleteAbortRef.current.abort();
        autocompleteAbortRef.current = null;
      }
      setSearchSuggestions([]);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    autocompleteAbortRef.current = controller;

    const timeoutId = setTimeout(async () => {
      try {
        setSearchLoading(true);
        setSearchMessage(null);

        const params = new URLSearchParams({
          input: trimmed,
          sessionToken: placesSessionToken,
          originLat: targetLocation.lat.toString(),
          originLng: targetLocation.lng.toString(),
        });

        const response = await fetch(`/api/places/autocomplete?${params.toString()}`, {
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => undefined);

        if (!response.ok) {
          const message = payload?.error ?? 'Failed to fetch suggestions';
          setSearchSuggestions([]);
          setSearchMessage(message);
          return;
        }

        const suggestions: PlaceSuggestion[] = Array.isArray(payload?.suggestions)
          ? payload.suggestions
          : [];
        setSearchSuggestions(suggestions);
        setSearchMessage(suggestions.length === 0 ? 'No suggestions found.' : null);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setSearchSuggestions([]);
        setSearchMessage(err instanceof Error ? err.message : 'Failed to fetch suggestions');
      } finally {
        setSearchLoading(false);
      }
    }, AUTOCOMPLETE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [placesSessionToken, searchQuery, suppressSuggestions, targetLocation.lat, targetLocation.lng]);

  const effectiveMaxPanels = useMemo(() => {
    if (panelInstances.length === 0) {
      return 0;
    }
    const capacity = maxPanelCapacity > 0 ? Math.min(maxPanelCapacity, panelInstances.length) : panelInstances.length;
    return capacity;
  }, [maxPanelCapacity, panelInstances.length]);

  useEffect(() => {
    const maxAvailable = effectiveMaxPanels;
    if (panelLimit > maxAvailable) {
      setPanelLimit(maxAvailable);
    }
  }, [effectiveMaxPanels, panelLimit]);

  const visiblePanels = useMemo(() => {
    if (panelLimit <= 0) {
      return [];
    }
    if (panelLimit >= panelInstances.length) {
      return panelInstances;
    }
    return panelInstances.slice(0, panelLimit);
  }, [panelInstances, panelLimit]);

  const panelLayer = useMemo<Layer | null>(() => {
    if (visiblePanels.length === 0) {
      return null;
    }

    return new ScenegraphLayer<PanelInstance>({
      id: 'solar-panels',
      data: visiblePanels,
      scenegraph: '/models/solar_panel.glb',
      getPosition: (d: PanelInstance) => d.position,
      getOrientation: (d: PanelInstance) => [-(d.pitchDeg ?? 0), 0, 180 - (d.azimuthDeg ?? 0)],
      getScale: (d: PanelInstance) => [d.dimensionsMeters[0], d.dimensionsMeters[1], 1],
      sizeScale: 1,
      pickable: false,
      parameters: {
        depthTest: true,
      },
    }) as unknown as Layer;
  }, [visiblePanels]);

  const tileLayer = useMemo<Layer>(() => {
    return new Tile3DLayer({
      id: 'google-3d-tiles',
      data: `https://tile.googleapis.com/v1/3dtiles/root.json?key=${apiKey}`,
      loadOptions: {
        fetch: {
          headers: {
            Accept: 'application/octet-stream',
            'X-GOOG-API-KEY': apiKey,
          },
        },
      },
      operation: 'draw',
      onTilesetLoad: (tileset: Tileset3D) => {
        const options = tileset?.options as Record<string, unknown>;
        if (options) {
          options.skipLevelOfDetail = false;
          options.maximumMemoryUsage = 512;
          options.viewDistanceScale = 1.2;
        }
      },
    }) as unknown as Layer;
  }, [apiKey]);

  const deckLayers = useMemo<LayersList>(() => {
    const layers: LayersList = [tileLayer];
    if (panelLayer) {
      layers.push(panelLayer);
    }
    return layers;
  }, [panelLayer, tileLayer]);

  const handlePlacePanels = useCallback(
    async (overrideLocation?: { lat: number; lng: number }, addressHint?: string) => {
      const location = overrideLocation ?? targetLocation;
      setError(null);

      if (overrideLocation) {
        setTargetLocation(overrideLocation);
      }

      try {
        const params = new URLSearchParams({
          lat: location.lat.toString(),
          lng: location.lng.toString(),
        });

        const response = await fetch(`/api/solar-layout?${params.toString()}`);
        const payload = await response.json();

        if (!response.ok) {
          const message = payload?.error ?? 'Failed to fetch solar layout';
          setError(message);
          throw new Error(message);
        }

        const insight: BuildingInsights = payload;
        const generatedPanels = createPanelInstancesFromBuilding(insight);
        if (generatedPanels.length === 0) {
          setError('No solar panels available for this location');
        }
        setPanelInstances(generatedPanels);

        const maxPanelsFromInsight =
          insight.solarPotential?.maxArrayPanelsCount ?? generatedPanels.length;
        setMaxPanelCapacity(maxPanelsFromInsight);

        const availablePanels =
          maxPanelsFromInsight > 0
            ? Math.min(maxPanelsFromInsight, generatedPanels.length)
            : generatedPanels.length;
        const initialLimit = Math.min(12, availablePanels);
        setPanelLimit(initialLimit);

        const centerLat = insight.center?.latitude ?? location.lat;
        const centerLng = insight.center?.longitude ?? location.lng;
        const resolvedCenter = { lat: centerLat, lng: centerLng };

        setTargetLocation(resolvedCenter);
        void fetchCalcMoney(resolvedCenter, addressHint ?? searchQuery);

        setViewState((prev) => ({
          ...prev,
          latitude: centerLat,
          longitude: centerLng,
          zoom: Math.max(prev.zoom, 19),
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error fetching solar layout');
      } finally {
        // no-op
      }
    },
    [fetchCalcMoney, searchQuery, targetLocation]
  );

  useEffect(() => {
    (async () => {
      await handlePlacePanels({ lat: defaultLocation.lat, lng: defaultLocation.lng }, searchQuery);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultLocation.lat, defaultLocation.lng]);

  const handleSearchInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchQuery(value);
    setSearchMessage(null);
    setSuppressSuggestions(false);

    if (!value.trim()) {
      setSearchSuggestions([]);
      setPlacesSessionToken(generateSessionToken());
    }
  }, []);

  const handleSuggestionSelect = useCallback(
    async (suggestion: PlaceSuggestion) => {
      setSearchQuery(suggestion.primaryText);
      setSearchSuggestions([]);
      setSearchMessage(null);
      setSuppressSuggestions(true);
      setSearchLoading(true);

      try {
        const params = new URLSearchParams({
          placeId: suggestion.placeId,
          sessionToken: placesSessionToken,
        });

        const response = await fetch(`/api/places/details?${params.toString()}`);
        const payload = await response.json().catch(() => undefined);

        if (!response.ok) {
          const message = payload?.error ?? 'Failed to fetch place details';
          setSearchMessage(message);
          return;
        }

        const place: PlaceDetails | undefined = payload?.place;
        const lat = place?.location?.latitude;
        const lng = place?.location?.longitude;

        if (typeof lat !== 'number' || typeof lng !== 'number') {
          setSearchMessage('Selected place is missing coordinates.');
          return;
        }

        if (place?.formattedAddress) {
          setSearchQuery(place.formattedAddress);
        } else if (place?.name) {
          setSearchQuery(place.name);
        }

        const newLocation = { lat, lng };
        setTargetLocation(newLocation);
        setViewState((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }));
        setPanelInstances([]);
        setPanelLimit(12);
        setMaxPanelCapacity(0);

        await handlePlacePanels(newLocation, place?.formattedAddress ?? place?.name ?? suggestion.primaryText);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setSearchMessage(err instanceof Error ? err.message : 'Failed to resolve place');
      } finally {
        setSearchLoading(false);
        setPlacesSessionToken(generateSessionToken());
      }
  }, [handlePlacePanels, placesSessionToken]);

  const handleSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' && searchSuggestions.length > 0) {
        event.preventDefault();
        handleSuggestionSelect(searchSuggestions[0]);
      }
    },
    [handleSuggestionSelect, searchSuggestions]
  );

  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        backgroundColor: '#000',
      }}
    >
      <DeckGL
        controller={{ dragRotate: true, touchRotate: true, keyboard: true }}
        initialViewState={initialViewState}
        viewState={viewState}
        onViewStateChange={({ viewState: next }) => {
          const state = next as MapViewState;
          setViewState((prev) => ({
            latitude: state.latitude ?? prev.latitude,
            longitude: state.longitude ?? prev.longitude,
            zoom: state.zoom ?? prev.zoom,
            pitch: state.pitch ?? prev.pitch,
            bearing: state.bearing ?? prev.bearing,
          }));
        }}
        layers={deckLayers}
        style={{ position: 'absolute', inset: '0' }}
      />

      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          padding: '12px 16px',
          borderRadius: 8,
          background: 'rgba(24, 24, 24, 0.85)',
          color: '#fff',
          width: 380,
          maxWidth: '90vw',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            paddingBottom: searchSuggestions.length > 0 ? 160 : 0,
          }}
        >
          <label style={{ fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', opacity: 0.8 }}>
            Search Address
          </label>
          <input
            value={searchQuery}
            onChange={handleSearchInputChange}
            onKeyDown={handleSearchKeyDown}
            placeholder="Start typing an address…"
            style={{
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid rgba(255, 255, 255, 0.18)',
              background: 'rgba(0, 0, 0, 0.35)',
              color: '#fff',
              fontSize: 14,
              outline: 'none',
            }}
          />
          {searchLoading && (
            <div style={{ fontSize: 11, opacity: 0.7 }}>Searching…</div>
          )}
          {searchSuggestions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                background: 'rgba(18, 18, 18, 0.96)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 8,
                boxShadow: '0 8px 18px rgba(0, 0, 0, 0.45)',
                maxHeight: 220,
                overflowY: 'auto',
                zIndex: 20,
              }}
            >
              {searchSuggestions.map((suggestion, index) => (
                <button
                  key={suggestion.placeId}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSuggestionSelect(suggestion)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderTop: index === 0 ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{suggestion.primaryText}</div>
                  {suggestion.secondaryText ? (
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{suggestion.secondaryText}</div>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>

        {searchMessage && (
          <div style={{ fontSize: 12, color: '#ffb74d' }}>{searchMessage}</div>
        )}

        <div>
          <strong>Current Location</strong>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {targetLocation.lat.toFixed(6)}, {targetLocation.lng.toFixed(6)}
          </div>
        </div>

        {effectiveMaxPanels > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', opacity: 0.8 }}>
              Panels to Display
            </label>
            <input
              type="range"
              min={0}
              max={effectiveMaxPanels}
              value={panelLimit}
              onChange={(event) => setPanelLimit(Number(event.target.value))}
            />
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Showing {visiblePanels.length} of {effectiveMaxPanels}
            </div>
          </div>
        ) : null}

        {(calcMoneyLoading || calcMoneyPayload) && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              marginTop: 8,
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 8,
              padding: 12,
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            {calcMoneyLoading ? (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Fetching cost information…</div>
            ) : (
              <div
                style={{
                  fontSize: 12,
                  lineHeight: 1.6,
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: 6,
                  padding: 10,
                }}
              >
                {calcMoneyPayload?.summary ?? 'No detailed rate information returned.'}
              </div>
            )}
          </div>
        )}

        {error ? <div style={{ color: '#ff8a65', fontSize: 13 }}>{error}</div> : null}
      </div>

    </div>
  );
}