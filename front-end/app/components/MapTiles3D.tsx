'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import type { Layer, LayersList, MapViewState } from '@deck.gl/core';
import { Tile3DLayer } from '@deck.gl/geo-layers';
import { SimpleMeshLayer } from '@deck.gl/mesh-layers';
import { registerLoaders } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';
import { DracoLoader } from '@loaders.gl/draco';
import { CubeGeometry } from '@luma.gl/engine';
import { Matrix4 } from '@math.gl/core';

interface MapTiles3DProps {
  apiKey: string;
  center?: { lat: number; lng: number };
  height?: string;
  width?: string;
}

interface PanelInstance {
  position: [number, number, number];
  transform: number[];
}

type DeckViewState = {
  latitude: number;
  longitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
};

const defaultCenter = {
  lat: 37.7793,
  lng: -122.4193,
};

const PANEL_LENGTH = 3.2;
const PANEL_WIDTH = 1.9;
const PANEL_THICKNESS = 0.15;
const PANEL_TILT_DEGREES = 90;
const PANEL_AZIMUTH_DEGREES = 0;
const PANEL_HEIGHT_ABOVE_GROUND = 55;
const EARTH_RADIUS = 6378137;

const INITIAL_VIEW_STATE: DeckViewState = {
  latitude: defaultCenter.lat,
  longitude: defaultCenter.lng,
  zoom: 18.7,
  pitch: 60,
  bearing: 0,
};

let loadersRegistered = false;

if (!loadersRegistered) {
  registerLoaders([GLTFLoader, DracoLoader]);
  loadersRegistered = true;
}

export default function MapTiles3D({
  apiKey,
  center = defaultCenter,
  height = '100vh',
  width = '100%',
}: MapTiles3DProps) {
  const [error, setError] = useState<string | null>(null);
  const [numPanels, setNumPanels] = useState<number>(12);
  const [showPanelConfig, setShowPanelConfig] = useState<boolean>(false);
  const [searchAddress, setSearchAddress] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [latInput, setLatInput] = useState<string>('');
  const [lngInput, setLngInput] = useState<string>('');
  const [panels, setPanels] = useState<PanelInstance[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [viewState, setViewState] = useState<DeckViewState>(() => ({
    ...INITIAL_VIEW_STATE,
    latitude: center.lat ?? INITIAL_VIEW_STATE.latitude,
    longitude: center.lng ?? INITIAL_VIEW_STATE.longitude,
  }));

  const cubeGeometry = useMemo(() => new CubeGeometry(), []);
  const identityTransform = useMemo(() => new Matrix4().identity().toArray(), []);

  const panelLayer = useMemo(
    () =>
      new SimpleMeshLayer<PanelInstance>({
        id: 'solar-panels',
        data: panels.filter((panel): panel is PanelInstance => Boolean(panel)),
        mesh: cubeGeometry,
        getPosition: (d: PanelInstance | undefined) => d?.position ?? [0, 0, 0],
        getTransformMatrix: (d: PanelInstance | undefined) => d?.transform ?? identityTransform,
        getColor: [0, 0, 128, 230],
      }),
    [cubeGeometry, identityTransform, panels]
  );

  const tilesLayer = useMemo(
    () =>
      new Tile3DLayer({
        id: 'google-3d-tiles',
        data: `https://tile.googleapis.com/v1/3dtiles/root.json?key=${apiKey}`,
        loadOptions: {
          throttleRequests: true,
        },
        onTilesetLoad: (tileset: unknown) => {
          setError(null);
          if (tileset && typeof tileset === 'object' && 'tileset' in tileset) {
            const tilesetData = tileset as { tileset?: { options?: Record<string, unknown> } };
            if (tilesetData.tileset) {
              const tileset3d = tilesetData.tileset;
              tileset3d.options = tileset3d.options || {};
              tileset3d.options.unloadTiles = false;
              tileset3d.options.refreshTiles = false;
              tileset3d.options.preloadTiles = true;
              tileset3d.options.viewDistanceScale = 3;
              tileset3d.options.maximumMemoryUsage = 512;
              tileset3d.options.refinementStrategy = 'REPLACE';
            }
          }
        },
        onError: (layerError: Error) => {
          console.error('Tiles3D error:', layerError);
          setTimeout(() => {
            setError(`Failed to load 3D tiles: ${layerError.message || 'Unknown error'}`);
          }, 0);
        },
      }),
    [apiKey]
  );

  const deckLayers = useMemo<LayersList>(
    () => [tilesLayer as unknown as Layer, panelLayer as unknown as Layer],
    [panelLayer, tilesLayer]
  );

  const createPanelInstances = useCallback(
    (lat: number, lng: number): PanelInstance[] => {
      const metersPerDegreeLat = (Math.PI / 180) * EARTH_RADIUS;
      const metersPerDegreeLng = metersPerDegreeLat * Math.cos((lat * Math.PI) / 180);

      const panelsPerRow = Math.ceil(Math.sqrt(numPanels));
      const panelSpacing = PANEL_LENGTH + 0.6;
      const totalWidth = (panelsPerRow - 1) * panelSpacing;
      const totalHeight = (panelsPerRow - 1) * panelSpacing;
      const startX = -totalWidth / 2;
      const startY = -totalHeight / 2;

      const pitchRad = (PANEL_TILT_DEGREES * Math.PI) / 180;
      const azimuthRad = (PANEL_AZIMUTH_DEGREES * Math.PI) / 180;

      const modelMatrix = new Matrix4()
        .identity()
        .scale([PANEL_LENGTH, PANEL_WIDTH, PANEL_THICKNESS])
        .rotateZ(Math.PI - azimuthRad)
        .rotateX(-pitchRad);

      const instances: PanelInstance[] = [];

      for (let i = 0; i < numPanels; i += 1) {
        const row = Math.floor(i / panelsPerRow);
        const col = i % panelsPerRow;

        const offsetX = startX + col * panelSpacing;
        const offsetY = startY + row * panelSpacing;

        const latOffset = offsetY / metersPerDegreeLat;
        const lngOffset = offsetX / metersPerDegreeLng;

        const panelLat = lat + latOffset;
        const panelLng = lng + lngOffset;

        instances.push({
          position: [panelLng, panelLat, PANEL_HEIGHT_ABOVE_GROUND],
          transform: modelMatrix.clone().toArray(),
        });
      }

      return instances;
    },
    [numPanels]
  );

  const placePanelsAt = useCallback(
    (lat: number, lng: number, opts?: { zoom?: number; recenter?: boolean; pitch?: number; bearing?: number }) => {
      const newPanels = createPanelInstances(lat, lng);
      setPanels(newPanels);

      if (opts?.recenter !== false) {
        setViewState((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          zoom: opts?.zoom ?? prev.zoom ?? INITIAL_VIEW_STATE.zoom,
          pitch: opts?.pitch ?? prev.pitch ?? INITIAL_VIEW_STATE.pitch,
          bearing: opts?.bearing ?? prev.bearing ?? INITIAL_VIEW_STATE.bearing,
        }));
      }
    },
    [createPanelInstances]
  );

  const handlePlacePanels = useCallback(() => {
    placePanelsAt(viewState.latitude, viewState.longitude, { recenter: false });
  }, [placePanelsAt, viewState.latitude, viewState.longitude]);

  const handleSearchAddress = useCallback(async () => {
    if (!searchAddress.trim()) {
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchAddress)}&key=${apiKey}`
      );
      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results[0]) {
        const location = data.results[0].geometry.location;
        placePanelsAt(location.lat, location.lng, { zoom: 19.5, recenter: true });
      } else {
        console.warn('Geocoding failed:', data);
        alert(`Geocoding failed: ${data.status || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Geocoding request failed:', err);
      alert('Failed to search address. Check console for details.');
    } finally {
      setIsSearching(false);
    }
  }, [apiKey, placePanelsAt, searchAddress]);

  const handleSearchLatLng = useCallback(() => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      alert('Please enter numeric latitude and longitude values.');
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      alert('Latitude must be between -90 and 90, longitude between -180 and 180.');
      return;
    }

    placePanelsAt(lat, lng, { zoom: 20, recenter: true });
  }, [latInput, lngInput, placePanelsAt]);

  const handleClearPanels = useCallback(() => {
    setPanels([]);
  }, []);

  useEffect(() => {
    if (initialized) {
      return;
    }

    const rafId = requestAnimationFrame(() => {
      placePanelsAt(center.lat, center.lng, {
        zoom: INITIAL_VIEW_STATE.zoom,
        recenter: true,
        pitch: INITIAL_VIEW_STATE.pitch,
        bearing: INITIAL_VIEW_STATE.bearing,
      });
      setInitialized(true);
    });

    return () => cancelAnimationFrame(rafId);
  }, [center.lat, center.lng, initialized, placePanelsAt]);

  if (error) {
    return (
      <div
        style={{
          height,
          width,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1e1e1e',
          color: '#fff',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <div>
          <h2 style={{ marginBottom: '10px' }}>Map Error</h2>
          <p style={{ marginBottom: '10px' }}>{error}</p>
          <p style={{ fontSize: '14px', opacity: 0.8 }}>Check console for additional details.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
      }}
    >
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={{
          dragRotate: true,
          touchRotate: true,
          keyboard: true,
        }}
        viewState={viewState}
        onViewStateChange={({ viewState: next }) => {
          const nextViewState = next as MapViewState;
          setViewState((prev) => ({
            latitude: nextViewState.latitude ?? prev.latitude,
            longitude: nextViewState.longitude ?? prev.longitude,
            zoom: nextViewState.zoom ?? prev.zoom,
            pitch: nextViewState.pitch ?? prev.pitch,
            bearing: nextViewState.bearing ?? prev.bearing,
          }));
        }}
        layers={deckLayers}
        style={{
          position: 'absolute',
          inset: '0',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearchAddress();
              }
            }}
            placeholder="Search address…"
            style={{
              padding: '12px 16px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              width: '300px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            }}
          />
          <button
            onClick={handleSearchAddress}
            disabled={isSearching || !searchAddress.trim()}
            style={{
              padding: '12px 20px',
              backgroundColor: isSearching || !searchAddress.trim() ? '#9ca3af' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isSearching || !searchAddress.trim() ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            }}
          >
            {isSearching ? 'Searching…' : 'Search'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={latInput}
            onChange={(e) => setLatInput(e.target.value)}
            placeholder="Latitude"
            style={{
              padding: '12px 16px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              width: '140px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            }}
          />
          <input
            type="text"
            value={lngInput}
            onChange={(e) => setLngInput(e.target.value)}
            placeholder="Longitude"
            style={{
              padding: '12px 16px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              width: '140px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            }}
          />
          <button
            onClick={handleSearchLatLng}
            style={{
              padding: '12px 20px',
              backgroundColor: '#0ea5e9',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            }}
          >
            Use Lat/Lng
          </button>
        </div>
      </div>

      {!showPanelConfig && (
        <button
          onClick={() => setShowPanelConfig(true)}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            zIndex: 20,
            padding: '12px 20px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          }}
        >
          Configure Solar Panels
        </button>
      )}

      {showPanelConfig && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            zIndex: 20,
            backgroundColor: 'rgba(255, 255, 255, 0.96)',
            borderRadius: '10px',
            padding: '20px',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.25)',
            minWidth: '320px',
            maxWidth: '360px',
          }}
        >
          <h3
            style={{
              margin: '0 0 16px 0',
              fontSize: '18px',
              fontWeight: 600,
              color: '#111827',
            }}
          >
            Solar Panel Configuration
          </h3>

          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#1f2937',
              }}
            >
              Number of Panels: {numPanels}
            </label>
            <input
              type="range"
              min="1"
              max="120"
              value={numPanels}
              onChange={(e) => setNumPanels(parseInt(e.target.value, 10))}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280' }}>
              <span>1</span>
              <span>120</span>
            </div>
          </div>

          <div style={{ marginBottom: '12px', fontSize: '13px', color: '#4b5563' }}>
            <p style={{ margin: 0, color: '#059669' }}>✓ Panels align with the current map center</p>
            <p style={{ margin: '4px 0 0 0' }}>Currently displaying: {panels.length} panels</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={handlePlacePanels}
              style={{
                padding: '12px 20px',
                backgroundColor: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'background-color 0.2s ease-in-out',
              }}
            >
              Place Solar Panels
            </button>
            <button
              onClick={handleClearPanels}
              style={{
                padding: '10px 20px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Clear Panels
            </button>
            <button
              onClick={() => setShowPanelConfig(false)}
              style={{
                padding: '10px 20px',
                backgroundColor: 'transparent',
                color: '#4b5563',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Close
            </button>
          </div>

          <div
            style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: '#f3f4f6',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#6b7280',
            }}
          >
            <strong>Tips:</strong>
            <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
              <li>Search an address or enter precise coordinates</li>
              <li>Use the mouse or trackpad to tilt, rotate, and zoom the 3D tiles</li>
              <li>Panels render with Deck.gl SimpleMeshLayer over Google Photorealistic 3D Tiles</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
