'use client';

import MapTiles3D from './components/MapTiles3D';

export default function Home() {
  // Get API key from environment variable
  // Note: This should be Map Tiles API key, not Maps JavaScript API key
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  if (!apiKey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4 text-black dark:text-zinc-50">
            Google Map Tiles API Key Required
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-2">
            Make sure to enable the Map Tiles API in Google Cloud Console
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen">
      <MapTiles3D
        apiKey={apiKey}
        center={{ lat: 37.7749, lng: -122.4194 }} // San Francisco (default)
        height="100vh"
        width="100%"
      />
    </div>
  );
}
