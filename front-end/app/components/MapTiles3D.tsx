'use client';

import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';

// Cesium needs to access the window object
if (typeof window !== 'undefined') {
  // Set Cesium base URL for assets
  // Use the Cesium build directory from node_modules (webpack will handle this)
  (window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = '/cesium/';
}

interface MapTiles3DProps {
  apiKey: string;
  center?: { lat: number; lng: number };
  height?: string;
  width?: string;
}

const defaultCenter = {
  lat: 37.7749,
  lng: -122.4194,
};

export default function MapTiles3D({
  apiKey,
  center = defaultCenter,
  height = '100vh',
  width = '100%',
}: MapTiles3DProps) {
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const updateCameraRef = useRef<((lat: number, lng: number, altitude?: number) => void) | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cesiumContainerRef.current || viewerRef.current) {
      return;
    }

    try {
      // Initialize Cesium Viewer with default UI controls enabled
      const viewer = new Cesium.Viewer(cesiumContainerRef.current, {
        baseLayerPicker: false,
        requestRenderMode: true,
        maximumRenderTimeChange: Infinity,
        shouldAnimate: false,
        // Enable default UI elements
        animation: false, // Keep animation disabled
        timeline: false, // Keep timeline disabled
        fullscreenButton: true, // Enable fullscreen button
        vrButton: false, // Keep VR disabled
        geocoder: true, // Enable search/geocoder button
        homeButton: true, // Enable home button (go back to home view)
        infoBox: true, // Enable info box
        sceneModePicker: true, // Enable scene mode picker (2D/3D/CV)
        selectionIndicator: true, // Enable selection indicator
        navigationHelpButton: false, // Keep navigation help disabled
        navigationInstructionsInitiallyVisible: false,
      });

      // Disable default imagery and terrain
      viewer.imageryLayers.removeAll();
      viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();

      // Hide the default globe
      viewer.scene.globe.show = false;

      // Suppress the ion access token warning by setting a dummy token
      // This prevents the warning message from appearing
      if (!Cesium.Ion.defaultAccessToken) {
        Cesium.Ion.defaultAccessToken = 'dummy-token';
      }

      // Hide only the navigation help panel with CSS (keep other UI)
      const style = document.createElement('style');
      style.id = 'cesium-hide-ui-styles';
      style.textContent = `
        .cesium-viewer-navigationHelp,
        .cesium-navigation-help {
          display: none !important;
        }
      `;
      document.head.appendChild(style);

      // Set a wider field of view for better visibility
      if (viewer.camera.frustum instanceof Cesium.PerspectiveFrustum) {
        viewer.camera.frustum.fov = Cesium.Math.toRadians(60); // Wider FOV (default is ~45)
      }

      // Function to update camera position
      const updateCamera = (lat: number, lng: number, altitude: number = 2000) => {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lng, lat, altitude),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-45), // Tilt for 3D view
            roll: 0.0,
          },
          duration: 2.0, // Animation duration in seconds
        });
      };

      // Set initial camera position with higher altitude for better view
      updateCamera(center.lat, center.lng, 3000);
      
      // Store updateCamera function for external use
      updateCameraRef.current = updateCamera;

      // Load Google's Photorealistic 3D Tiles
      const tilesetUrl = `https://tile.googleapis.com/v1/3dtiles/root.json?key=${apiKey}`;
      
      // Use fromUrl which returns a Promise
      Cesium.Cesium3DTileset.fromUrl(tilesetUrl, {
        showCreditsOnScreen: true, // Required for attribution
        maximumScreenSpaceError: 2, // Quality setting
      })
        .then((tileset) => {
          viewer.scene.primitives.add(tileset);
          // Don't auto-zoom to tileset - keep the wider view we set
          // viewer.zoomTo(tileset); // Commented out to maintain wider view
          setError(null);
        })
        .catch((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('Error loading 3D tiles:', error);
          setError(`Failed to load 3D tiles: ${errorMessage}`);
        });

      viewerRef.current = viewer;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Error initializing Cesium:', err);
      // Use setTimeout to avoid calling setState synchronously in effect
      setTimeout(() => {
        setError(`Failed to initialize map: ${errorMessage}`);
      }, 0);
    }

    // Cleanup function
    return () => {
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy();
        } catch (err) {
          console.error('Error destroying viewer:', err);
        }
        viewerRef.current = null;
      }
      // Remove the style tag
      const styleTag = document.getElementById('cesium-hide-ui-styles');
      if (styleTag) {
        styleTag.remove();
      }
    };
  }, [apiKey, center.lat, center.lng]);

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
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: '10px' }}>Map Loading Error</h2>
          <p>{error}</p>
          <p style={{ marginTop: '10px', fontSize: '14px', opacity: 0.8 }}>
            Check the browser console for more details.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height,
        width,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Cesium Map Container */}
      <div
        ref={cesiumContainerRef}
        style={{
          height: '100%',
          width: '100%',
        }}
      />
    </div>
  );
}

