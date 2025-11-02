This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Google Maps 3D Setup

This project includes a 3D Google Maps component. To use it:

1. **Get a Google Maps API Key:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/google/maps-apis)
   - Create a new project or select an existing one
   - Enable the "Maps JavaScript API"
   - Create an API key

2. **Create a Map ID (REQUIRED for 3D buildings):**
   - In Google Cloud Console, go to **APIs & Services** > **Maps** > **Map Styles** (or **Maps JavaScript API** > **Map Styles**)
   - Click **Create Map ID**
   - Choose **Vector** as the map type
   - Give it a name (e.g., "3D Buildings Map")
   - Click **Create**
   - After creation, edit the Map ID and ensure the **3D buildings** layer is enabled
   - Copy the Map ID (it looks like: `1234567890abcdef`)
   - **Important**: Without a valid Map ID, 3D buildings will NOT display. The map will show in 2D even with tilt enabled.

3. **Set Environment Variables:**
   - Create a `.env.local` file in the `front-end` directory
   - Add the following:
     ```
     NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
     NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=your_map_id_here
     ```
   - **Note**: The Map ID is REQUIRED for 3D buildings to display. Without it, you'll only see a tilted 2D map.

4. **Using the 3D Map:**
   - The map is displayed on the home page (`app/page.tsx`)
   - **3D Buildings**: With a valid Map ID, 3D buildings will automatically appear when:
     - You're viewing a location with 3D building data (major cities worldwide)
     - The map is zoomed in enough (zoom level 15+)
     - The map is tilted (default 45 degrees)
   - You can interact with it using:
     - **Right-click + drag**: Rotate and tilt the map
     - **Scroll**: Zoom in/out
     - **Left-click + drag**: Pan the map
     - **Shift + Left-click + drag**: Tilt the map
   - The map is configured with a 45-degree tilt for optimal 3D building viewing

## Troubleshooting

### ApiTargetBlockedMapError

If you encounter `ApiTargetBlockedMapError`, try the following:

1. **Check API Key Restrictions:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/) > **APIs & Services** > **Credentials**
   - Click on your API key
   - Under **Application restrictions**, ensure:
     - For development: Use "None" or add `localhost` and `127.0.0.1` to HTTP referrers
     - For production: Add your domain to HTTP referrers
   - Under **API restrictions**, ensure "Maps JavaScript API" is enabled (or set to "Don't restrict key")

2. **Remove Invalid Map ID:**
   - If you're getting this error, try removing `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` from your `.env.local` file
   - The map will work without a Map ID, though 3D buildings may not be as detailed
   - Only include a Map ID if you've created one in Google Cloud Console and it's associated with your API key

3. **Verify APIs are Enabled:**
   - Go to **APIs & Services** > **Library**
   - Ensure "Maps JavaScript API" is enabled for your project

4. **Check API Key Usage:**
   - Make sure you're using the correct API key in your `.env.local` file
   - Restart your development server after changing environment variables

## Getting Started

First, set up your environment variables as described above, then run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
