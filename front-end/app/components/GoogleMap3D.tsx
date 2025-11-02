'use client';

import { useCallback, useMemo } from 'react';
import { GoogleMap, LoadScript, LoadScriptProps } from '@react-google-maps/api';

interface GoogleMap3DProps {
  apiKey: string;
  mapId?: string;
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: string;
  width?: string;
}

// Note: 'maps3d' library is loaded automatically when using mapId with 3D features
// For @react-google-maps/api, we don't need to explicitly include it in libraries
const libraries: LoadScriptProps['libraries'] = [];

const defaultCenter = {
  lat: 37.7749,
  lng: -122.4194,
};

const defaultZoom = 15;

export default function GoogleMap3D({
  apiKey,
  mapId,
  center = defaultCenter,
  zoom = defaultZoom,
  height = '100vh',
  width = '100%',
}: GoogleMap3DProps) {
  // Callback when map loads - configure for 3D buildings
  const onLoad = useCallback((_map: google.maps.Map) => {
    // Map is loaded and configured for 3D buildings
    // 3D buildings will automatically display when:
    // 1. A valid mapId with 3D buildings is provided
    // 2. The location has 3D building data available (major cities)
    // 3. The map is tilted (which we set to 45 degrees)
    if (mapId) {
      console.log('Map loaded with 3D buildings enabled');
    }
  }, [mapId]);

  const mapOptions = useMemo(() => {
    const options: google.maps.MapOptions = {
      disableDefaultUI: false,
      clickableIcons: true,
      scrollwheel: true,
      tilt: 45, // Enable 3D tilt (0-45 degrees) - required for 3D buildings
      heading: 0,
      zoomControl: true,
      mapTypeControl: true,
      scaleControl: true,
      streetViewControl: true,
      rotateControl: true,
      fullscreenControl: true,
      mapTypeId: 'roadmap' as const,
      gestureHandling: 'auto' as const, // Changed to 'auto' for better 3D interaction
      // Enable 3D buildings - requires a valid Map ID
      // Without mapId, 3D buildings may still show in supported areas but less detailed
    };

    // Map ID is REQUIRED for best 3D building visualization
    // Create a Map ID in Google Cloud Console with "3D buildings" layer enabled
    if (mapId && mapId.trim() !== '') {
      options.mapId = mapId;
    } else {
      // Try to use a default approach - some areas may show basic 3D buildings
      // Note: For full 3D buildings, you MUST provide a valid Map ID
      console.warn('No Map ID provided. 3D buildings may not display optimally. Please create a Map ID in Google Cloud Console.');
    }

    return options;
  }, [mapId]);

  return (
    <LoadScript 
      googleMapsApiKey={apiKey} 
      libraries={libraries}
      loadingElement={<div className="flex items-center justify-center h-full">Loading map...</div>}
    >
      <GoogleMap
        mapContainerStyle={{
          height,
          width,
        }}
        center={center}
        zoom={zoom}
        options={mapOptions}
        onLoad={onLoad}
      >
        {/* You can add markers, polygons, or other components here */}
      </GoogleMap>
    </LoadScript>
  );
}

