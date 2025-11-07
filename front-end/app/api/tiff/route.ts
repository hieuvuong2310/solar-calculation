import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { fromArrayBuffer } from 'geotiff';

interface GeoTiffMetadata {
  width: number;
  height: number;
  samplesPerPixel: number;
  fileDirectory: Record<string, unknown>;
  geoKeys: Record<string, unknown>;
  origin?: number[];
  resolution?: number[];
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), '..', 'test.tiff');
    const buffer = await readFile(filePath);

    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const tiff = await fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage();

    const meta: GeoTiffMetadata = {
      width: image.getWidth(),
      height: image.getHeight(),
      samplesPerPixel: image.getSamplesPerPixel(),
      fileDirectory: image.getFileDirectory(),
      geoKeys: image.getGeoKeys(),
      origin: image.getOrigin(),
      resolution: image.getResolution(),
    };

    return NextResponse.json({
      success: true,
      metadata: meta,
    });
  } catch (error) {
    console.error('Failed to read GeoTIFF:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
