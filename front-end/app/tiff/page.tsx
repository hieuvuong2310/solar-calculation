'use client';

import { useEffect, useMemo, useState } from 'react';

interface TiffResponse {
  success: boolean;
  metadata?: {
    width: number;
    height: number;
    samplesPerPixel: number;
    fileDirectory: Record<string, unknown>;
    geoKeys: Record<string, unknown>;
    origin?: number[];
    resolution?: number[];
  };
  error?: string;
}

export default function TiffViewerPage() {
  const [metadata, setMetadata] = useState<TiffResponse['metadata']>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    const fetchMetadata = async () => {
      try {
        const response = await fetch('/api/tiff');
        const data: TiffResponse = await response.json();

        if (cancelled) {
          return;
        }

        if (!data.success || !data.metadata) {
          setError(data.error || 'Failed to load TIFF metadata');
          return;
        }

        setMetadata(data.metadata);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unexpected error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchMetadata();

    return () => {
      cancelled = true;
    };
  }, []);

  const metadataEntries = useMemo(() => {
    if (!metadata) {
      return [];
    }

    const entries: { label: string; value: string }[] = [
      { label: 'Width', value: `${metadata.width} px` },
      { label: 'Height', value: `${metadata.height} px` },
      { label: 'Samples Per Pixel', value: `${metadata.samplesPerPixel}` },
    ];

    if (metadata.origin) {
      entries.push({ label: 'Origin', value: metadata.origin.join(', ') });
    }

    if (metadata.resolution) {
      entries.push({ label: 'Resolution', value: metadata.resolution.join(', ') });
    }

    return entries;
  }, [metadata]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center px-6 py-12">
      <div className="w-full max-w-4xl space-y-8">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">GeoTIFF Metadata Viewer</h1>
          <p className="mt-2 text-slate-300">
            This page reads the bundled <code className="bg-slate-800 px-1 rounded">test.tiff</code> file on the server and exposes
            its metadata through an API endpoint.
          </p>
        </header>

        {loading && (
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-slate-300">
            Loading TIFF metadata…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-red-800/60 bg-red-900/30 p-6 text-red-200">
            <h2 className="text-lg font-semibold">Failed to read TIFF</h2>
            <p className="mt-2 text-sm">{error}</p>
          </div>
        )}

        {!loading && metadata && (
          <section className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-lg font-semibold text-slate-100">Summary</h2>
              <dl className="mt-4 space-y-3 text-sm text-slate-300">
                {metadataEntries.map((entry) => (
                  <div key={entry.label} className="flex justify-between gap-4">
                    <dt className="uppercase tracking-wide text-xs text-slate-500">{entry.label}</dt>
                    <dd className="font-medium text-slate-100">{entry.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-lg font-semibold text-slate-100">Geo Keys</h2>
              <pre className="mt-4 max-h-72 overflow-auto rounded bg-slate-950/60 p-4 text-xs text-slate-200">
                {JSON.stringify(metadata.geoKeys, null, 2)}
              </pre>
            </div>

            <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-lg font-semibold text-slate-100">File Directory</h2>
              <pre className="mt-4 max-h-96 overflow-auto rounded bg-slate-950/60 p-4 text-xs text-slate-200">
                {JSON.stringify(metadata.fileDirectory, null, 2)}
              </pre>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
