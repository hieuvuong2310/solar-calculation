'use client';

import GoogleMap3D from './components/GoogleMap3D';

export default function Home() {
  // Get API key from environment variable
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  if (!apiKey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4 text-black dark:text-zinc-50">
            Google Maps API Key Required
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen">
      <GoogleMap3D
        apiKey={apiKey}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
        center={{ lat: 37.7749, lng: -122.4194 }} // San Francisco (default)
        zoom={18}
        height="100vh"
        width="100%"
      />
    </div>
  );
}
