# Daily Health Monitor

A conversational daily health monitoring app that feels like a brief check-in with a friend, not a logbook. It tracks your daily habits, correlates them with weather and other variables, discovers patterns, and gently suggests improvements.

## Features

- **Conversational Check-In** - A chat-style daily check-in that covers mood, sleep, nutrition, hydration, exercise, stress, social interactions, and more
- **Weather Correlation** - Automatically fetches weather data via Open-Meteo (free, no API key needed) and correlates it with your health metrics
- **Cycle Tracking** - Optional hormonal cycle tracking for additional pattern analysis
- **Pattern Detection** - Pearson correlation analysis across all tracked variables to find what affects your mood, energy, sleep, and stress
- **Gentle Suggestions** - Actionable, friendly suggestions based on discovered patterns
- **Dashboard** - Visual trends over time with interactive charts
- **History** - Browse and review past check-ins

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Recharts
- **Backend**: Express + TypeScript + better-sqlite3
- **Weather**: Open-Meteo API (free, no key required)

## Quick Start

```bash
# Install all dependencies
npm run install:all

# Run both server and client in development mode
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## How It Works

1. **Daily Check-In**: Each day, open the app and start your check-in. It asks ~18 conversational questions about your day - takes about 3-5 minutes.

2. **Data Collection**: Your answers are parsed into numeric metrics (mood 1-10, sleep hours, water glasses, etc.) and stored locally in SQLite.

3. **Weather Integration**: Weather for your location is automatically fetched and stored alongside your check-in data.

4. **Pattern Analysis**: After ~5+ days of data, the engine runs Pearson correlations between all variable pairs to find what affects your outcomes (mood, energy, sleep quality, stress).

5. **Insights**: Significant correlations (|r| >= 0.3) are surfaced as friendly insights with actionable suggestions.

## Settings

- **Name**: Personalizes your greeting
- **Location**: Latitude/longitude for weather data (auto-detect available)
- **Timezone**: For accurate weather fetching
- **Cycle Tracking**: Toggle menstrual cycle day tracking on/off

## Project Structure

```
├── server/
│   └── src/
│       ├── index.ts              # Express server entry
│       ├── models/database.ts    # SQLite schema & connection
│       ├── routes/
│       │   ├── checkin.ts        # Check-in flow API
│       │   ├── dashboard.ts      # Dashboard & insights API
│       │   └── settings.ts       # Settings API
│       └── services/
│           ├── conversation.ts   # Question flow & metric extraction
│           ├── weather.ts        # Open-Meteo integration
│           └── patterns.ts       # Correlation & trend analysis
├── client/
│   └── src/
│       ├── App.tsx               # Router & navigation
│       ├── pages/
│       │   ├── CheckinPage.tsx   # Chat-style check-in UI
│       │   ├── DashboardPage.tsx # Charts, stats & insights
│       │   ├── HistoryPage.tsx   # Past check-in browser
│       │   └── SettingsPage.tsx  # User preferences
│       ├── services/api.ts       # API client
│       └── styles/global.css     # App-wide styles
```
