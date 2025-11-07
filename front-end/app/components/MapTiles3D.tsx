'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMapsOverlay } from '@deck.gl/google-maps';
import { Tile3DLayer } from '@deck.gl/geo-layers';
import { SimpleMeshLayer } from '@deck.gl/mesh-layers';
import { registerLoaders } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';
import { DracoLoader } from '@loaders.gl/draco';
import { CubeGeometry } from '@luma.gl/engine';
import { Matrix4 } from '@math.gl/core';

type GoogleMaps = typeof google.maps;

interface MapTiles3DProps {
  apiKey: string;
  mapId?: string;
  center?: { lat: number; lng: number };
  height?: string;
  width?: string;
}

interface PanelInstance {
  position: [number, number, number];
  transform: number[];
}

const defaultCenter = {
  lat: 37.7793,
  lng: -122.4193,
};

const PANEL_LENGTH = 3.2;
const PANEL_WIDTH = 1.9;
const PANEL_THICKNESS = 0.15;
const PANEL_TILT_DEGREES = 35;
const PANEL_AZIMUTH_DEGREES = 0;
const PANEL_HEIGHT_ABOVE_GROUND = 55;
const EARTH_RADIUS = 6378137;

let loadersRegistered = false;

if (!loadersRegistered) {
  registerLoaders([GLTFLoader, DracoLoader]);
  loadersRegistered = true;
}

export default function MapTiles3D({
  apiKey,
  mapId,
  center = defaultCenter,
  height = '100vh',
  width = '100%',
}: MapTiles3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlayRef = useRef<GoogleMapsOverlay | null>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const hasPlacedDefaultRef = useRef<boolean>(false);

  const [mapsLoaded, setMapsLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [numPanels, setNumPanels] = useState<number>(12);
  const [showPanelConfig, setShowPanelConfig] = useState<boolean>(false);
  const [searchAddress, setSearchAddress] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [latInput, setLatInput] = useState<string>('');
  const [lngInput, setLngInput] = useState<string>('');
  const [panels, setPanels] = useState<PanelInstance[]>([]);

  const mapOptions = useMemo<google.maps.MapOptions>(
    () => ({
      mapId: mapId && mapId.trim() !== '' ? mapId : undefined,
      disableDefaultUI: false,
      clickableIcons: true,
      gestureHandling: 'greedy',
      zoomControl: true,
      mapTypeControl: true,
      scaleControl: true,
      streetViewControl: true,
      rotateControl: true,
      fullscreenControl: true,
      tilt: 45,
      heading: 0,
      minZoom: 17,
      maxZoom: 21,
    }),
    [mapId]
  );

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

  const updateOverlayLayers = useCallback(() => {
    if (!overlayRef.current) {
      return;
    }
    overlayRef.current.setProps({ layers: [tilesLayer, panelLayer] });
  }, [panelLayer, tilesLayer]);

  const loadGoogleMapsScript = useCallback(() => {
    if (typeof window === 'undefined' || mapsLoaded) {
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps-api]');
    if (existing) {
      scriptRef.current = existing;
      setMapsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsApi = 'true';
    script.onload = () => setMapsLoaded(true);
    script.onerror = () => setError('Failed to load Google Maps JavaScript API');
    document.head.appendChild(script);
    scriptRef.current = script;
  }, [apiKey, mapsLoaded]);

  const initializeMap = useCallback(
    (maps: GoogleMaps) => {
      if (!containerRef.current || mapRef.current) {
        return;
      }

      const map = new maps.Map(containerRef.current, {
        ...mapOptions,
        center,
        zoom: 19,
      });

      map.setTilt(45);
      map.setHeading(0);

      const overlay = new GoogleMapsOverlay({
        layers: [tilesLayer, panelLayer],
      });

      overlay.setMap(map);

      mapRef.current = map;
      overlayRef.current = overlay;
    },
    [center, mapOptions, panelLayer, tilesLayer]
  );

  useEffect(() => {
    if (mapsLoaded) {
      return;
    }

    const rafId = requestAnimationFrame(() => {
      loadGoogleMapsScript();
    });

    return () => cancelAnimationFrame(rafId);
  }, [loadGoogleMapsScript, mapsLoaded]);

  useEffect(() => {
    if (!mapsLoaded) {
      return;
    }

    if (!window.google || !window.google.maps) {
      const timeoutId = window.setTimeout(() => {
        setError('Google Maps API not available');
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    initializeMap(window.google.maps);
  }, [initializeMap, mapsLoaded]);

  useEffect(() => {
    updateOverlayLayers();
  }, [updateOverlayLayers]);

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
        .scale([PANEL_LENGTH, PANEL_THICKNESS, PANEL_WIDTH])
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
    (lat: number, lng: number, opts?: { zoom?: number; recenter?: boolean }) => {
      const map = mapRef.current;
      if (!map) {
        console.warn('Map not ready for placing panels');
        return;
      }

      const newPanels = createPanelInstances(lat, lng);
      setPanels(newPanels);

      if (opts?.recenter !== false) {
        map.panTo({ lat, lng });
      }

      if (opts?.zoom) {
        map.setZoom(opts.zoom);
      }

      map.setTilt(45);
      map.setHeading(0);
    },
    [createPanelInstances]
  );

  const handlePlacePanels = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const mapCenter = map.getCenter();
    if (!mapCenter) {
      return;
    }
    placePanelsAt(mapCenter.lat(), mapCenter.lng(), { recenter: false });
  }, [placePanelsAt]);

  const handleSearchAddress = useCallback(() => {
    if (!searchAddress.trim() || !window.google?.maps) {
      return;
    }

    const geocoder = new google.maps.Geocoder();
    setIsSearching(true);

    geocoder.geocode({ address: searchAddress }, (results, status) => {
      setIsSearching(false);

      if (status === 'OK' && results && results[0]) {
        const location = results[0].geometry.location;
        placePanelsAt(location.lat(), location.lng(), { zoom: 20, recenter: true });
      } else {
        alert(`Geocoding failed: ${status}`);
      }
    });
  }, [placePanelsAt, searchAddress]);

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
    if (mapRef.current && !hasPlacedDefaultRef.current) {
      hasPlacedDefaultRef.current = true;
      const rafId = requestAnimationFrame(() => {
        placePanelsAt(center.lat, center.lng, { zoom: 19, recenter: true });
      });

      return () => cancelAnimationFrame(rafId);
    }

    return undefined;
  }, [center.lat, center.lng, placePanelsAt]);

  useEffect(() => () => {
    overlayRef.current?.setMap(null);
    overlayRef.current = null;
    mapRef.current = null;
    if (scriptRef.current && scriptRef.current.dataset.googleMapsApi) {
      scriptRef.current.remove();
      scriptRef.current = null;
    }
  }, []);

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
      {!mapsLoaded && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(17, 24, 39, 0.85)',
            color: '#fff',
            zIndex: 10,
            fontSize: '16px',
            letterSpacing: '0.05em',
          }}
        >
          Loading Google Maps…
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          inset: 0,
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
              <li>Map auto-tilts to 45° for 3D building visualization</li>
              <li>Panels render with Deck.gl SimpleMeshLayer on Google Maps</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
