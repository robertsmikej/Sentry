<p align="center">
  <img src="public/logos/sentry_logo_tight_padding.png" alt="Sentry Logo" width="80" height="80">
  <br>
  <img src="public/logos/sentry_text_tight_padding.png" alt="Sentry" height="40">
</p>

<p align="center">
  <strong>Protect what matters</strong> — A privacy-focused license plate tracking app that works offline and keeps your data under your control.
</p>

<p align="center">
  <strong>Want your own private instance?</strong><br>
  Click below to deploy your own copy — no coding required, free hosting included.
</p>

<p align="center">
  <a href="https://app.netlify.com/start/deploy?repository=https://github.com/robertsmikej/plate-reader">
    <img src="https://www.netlify.com/img/deploy/button.svg" alt="Deploy to Netlify">
  </a>
</p>

Sentry helps you quickly identify and track license plates using your phone's camera or photo library. Whether you're monitoring vehicles entering your neighborhood, tracking visitors to your property, or keeping records for security purposes, Sentry gives you the tools you need while completely respecting your privacy.
<br><br>

## Features

- **Camera Scanning** — Point your camera at a license plate to capture it instantly
  - Can read plates locally on your phone with OCR, or use Gemini AI for more accurate recognition (AI requires internet)
- **Photo Scanning** — Import photos from your library to extract plate numbers
- **Manual Entry** — Type in plate numbers directly
- **Match Alerts** — Get notified immediately when a scanned plate matches one on your watch list
- **Encounter Map** — View your recent encounters on an interactive map to see activity patterns in your area
- **Plate Database** — Keep track of known plates with names, notes, and experience ratings
  - Store all data locally on your device, or sync to Google Sheets to share with others
- **Encounter History** — See when and where you've encountered each plate
- **Search & Filter** — Quickly find plates and encounters
- **Dark Mode** — Easy on the eyes for nighttime use and saves battery on OLED screens
- **Share Database** — Generate links to share your database with family, neighbors, or team members
- **Export Data** — Download your plates and encounters as CSV files for backup or import into spreadsheets
  <br><br>

## Privacy & Security

Sentry is designed with privacy as a core principle:

### Your Data Stays Local

- All plate data and encounter history is stored **locally on your device** using IndexedDB
- The app works completely offline — no internet connection required for basic functionality
- Photos you scan are processed **entirely on your device** — they are never uploaded anywhere

### Google Sheets Integration (Optional)

- If you use Google Sheets sync, data only goes to **your own Google Sheet** or a shared community sheet you explicitly choose
- No data is ever sent to the app developers or any third-party servers
- You can export or delete your data at any time

### Location Privacy

- Location tracking is optional, used only in your data, and can be disabled in Settings
- When enabled, you can choose your precision level:
  - **Exact** — Full GPS coordinates
  - **Neighborhood** — Rounded to ~0.5 mile radius
  - **City** — Only city-level location stored

### AI Recognition (Optional)

- If you enable Gemini AI for better plate recognition, images are sent to Google's API
- Your Gemini API key is stored locally and never shared
- You can use the built-in OCR instead, which runs entirely offline
  <br><br>

## Offline Support

You shouldn't need cell service to stay vigilant.
Sentry is built to work completely offline:

- **Scan plates** without an internet connection
- **View all your data** — plates, encounters, and history
- **Add notes and details** to plates while offline
- Sync automatically when you're back online

The app pre-downloads everything it needs on your first visit (including OCR language files) so you're never caught without access to your data.
<br><br>

## Frequently Asked Questions

### Is my data safe?

**Yes.** At least it's safe from us. Your data is stored locally on your device and optionally synced to your own Google Sheet. The app developers have no access to your data, nor do we want it! If you choose to use the default Google Sheet options, you'll join a "database" sheet that others are contributing to, but you can also start your own Sheet and share that with just those you choose as well. We implemented the group sheet, just in the interest of having a larger set of data for people to immediately be able to match plates with, but it's not required at all.

### Can I use this without Google Sheets?

Absolutely. The app works fully offline with local storage only. Google Sheets integration is optional and only needed if you want cloud backup, or sharing and collecting plates with other people (this may be preferred to grow the list as quickly as possible).

### Can I add data directly to my Google Sheet, so I don't have to enter all my already known plate numbers manually in the app?

Yes, just be careful that it's formatted correctly (no spaces in plate numbers, etc.), but if you're confident in your ability to add it, go right ahead. Just sync in the app settings when done and you'll have the data on your device for offline use.

### Does this work on desktop?

Yes, you can use Sentry in any modern web browser. It looks best on mobile, and the camera features work best on mobile devices, but you can easily upload photos and manage your database from desktop.

### Can I share my database with others?

Yes. Go to Settings and use the "Share Database" feature to generate a link. Anyone with the link can join your shared database.
<br><br>

## Installing the App

Sentry is a Progressive Web App (PWA), which means you can install it directly from your browser — no app store required.

### iPhone / iPad

1. Open Safari and go to the Sentry website
2. Tap the **Share** button (square with arrow pointing up)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"** in the top right corner

The app icon will appear on your home screen and work just like a native app.

### Android

1. Open Chrome and go to the Sentry website
2. Tap the **three-dot menu** in the top right
3. Tap **"Add to Home screen"** or **"Install app"**
4. Tap **"Install"**

## Getting Started

### Quick Setup (Recommended)

When you first open Sentry, you'll see a setup prompt.

The easiest way to get started is to tap **"Use Shared Database"** — this connects you to a community database where you can benefit from plates that others have already identified.

### Using Your Own Google Sheet

If you prefer complete control over your data, you can set up your own Google Sheet. This keeps your data completely private — only stored on your device and in your personal Google Sheet.

#### Step 1: Create a Google Sheet

1. Go to [sheets.new](https://sheets.new) to create a new Google Sheet
2. Rename it to something like "Sentry Plates" (optional)
3. The app will automatically create the needed tabs (Plates, Encounters) when you first sync

#### Step 2: Get the Sheet URL for Reading

1. In your Google Sheet, go to **File → Share → Publish to web**
2. Under "Link", select **Entire Document** and **Comma-separated values (.csv)**
3. Click **Publish**
4. Copy the URL that appears — this is your **Read URL**

#### Step 3: Set Up Apps Script for Writing

To enable two-way sync (writing data back to the sheet), you need to deploy an Apps Script:

1. In your Google Sheet, go to **Extensions → Apps Script**
2. Delete any existing code in the editor
3. Copy the entire Apps Script code from the app's Settings page (under "Apps Script Code")
4. Paste it into the Apps Script editor
5. Click **Save** (💾 icon)
6. Click **Deploy → New deployment**
7. Click the gear icon (⚙️) next to "Select type" and choose **Web app**
8. Set the following:
   - **Description**: "Sentry Sync" (or anything you like)
   - **Execute as**: Me
   - **Who has access**: Anyone
9. Click **Deploy**
10. Click **Authorize access** and follow the prompts to grant permissions
11. Copy the **Web app URL** — this is your **Write URL**

#### Step 4: Configure the App

1. Open Sentry and go to **Settings**
2. Paste your **Read URL** in the "Google Sheets URL" field
3. Paste your **Write URL** in the "Apps Script URL" field
4. Your settings will auto-save

That's it! Your data will now sync between your device and your personal Google Sheet.

#### Sharing Your Sheet with Others

Once set up, you can share your database with family or neighbors:

1. Go to **Settings → Share Database**
2. Generate a shareable link
3. Send the link to others — when they open it, they'll be prompted to join your database
<br><br>

# Developer Documentation

The following sections are for developers who want to contribute to or modify Sentry.

To get this app released quickly to help people, the project was written in 2 days with heavy AI help from Claude, so there are likely issues in some spots. Just keep that in mind when poking around.

## Tech Stack

- **React 18** with TypeScript
- **Vite** for development and building
- **Tailwind CSS** + **DaisyUI** for styling
- **IndexedDB** (via idb) for local storage
- **Tesseract.js** for offline OCR
- **Google Gemini API** for AI-powered recognition (optional)
- **Workbox** for PWA/service worker support

## Project Structure

```
src/
├── components/       # React components
│   ├── Dashboard.tsx       # Home screen with stats and quick actions
│   ├── Scanner.tsx         # Camera/upload/manual plate entry
│   ├── PlateList.tsx       # List of all known plates
│   ├── EncounterList.tsx   # Encounter history
│   ├── EncounterMap.tsx    # Interactive map of recent encounters
│   ├── Settings.tsx        # App configuration
│   └── ...
├── services/         # Business logic and data layer
│   ├── storage.ts          # IndexedDB operations
│   ├── ocr.ts              # Tesseract.js OCR processing
│   ├── gemini.ts           # Gemini AI integration
│   ├── writeSync.ts        # Google Sheets write operations
│   └── sharing.ts          # Database sharing utilities
├── hooks/            # Custom React hooks
│   ├── useLookup.ts        # Main data fetching hook
│   ├── useAutoSync.ts      # Automatic sync management
│   └── useOfflinePrep.ts   # Offline asset preparation
├── types/            # TypeScript type definitions
├── constants/        # App constants and configuration
└── App.tsx           # Main app component with navigation
```

## Local Development

### Prerequisites

- Node.js 20.19+ or 22.12+
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/robertsmikej/plate-reader.git
cd plate-reader

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Available Scripts

```bash
npm run dev       # Start development server with HMR
npm run build     # Build for production
npm run preview   # Preview production build locally
npm run lint      # Run ESLint
```

## Building for Production

```bash
npm run build
```

This creates a `dist/` folder with:

- Optimized JavaScript bundles
- Service worker for offline support
- All static assets

Deploy the contents of `dist/` to any static hosting service (Netlify, Vercel, GitHub Pages, etc.)

## Architecture Overview

### Data Storage

All data is stored in IndexedDB with the following stores:

- **plates** — Known license plates with metadata (name, description, experience rating)
- **encounters** — Individual sightings with timestamps and optional location
- **settings** — User preferences and sync configuration

### Sync Architecture

1. **Read Sync** — Pulls data from a published Google Sheet CSV
2. **Write Sync** — Pushes local changes to Google Sheets via Apps Script
3. **Conflict Resolution** — Local changes take precedence; sync is additive

### OCR Pipeline

1. Image captured/uploaded
2. Preprocessed (contrast, grayscale, resize)
3. Processed by Tesseract.js (offline) or Gemini API (online)
4. Results validated against plate format patterns
5. User confirms or edits the recognized text

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/).

**In short:** You can use, modify, and share this code for any non-commercial purpose. Commercial use requires separate permission.

See the [LICENSE](LICENSE) file for the full license text.
