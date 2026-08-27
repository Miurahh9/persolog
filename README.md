# Logbook

A simple, offline-first personal logbook. Write entries, tag them with a time of day (morning, noon, evening, night), and filter your entries list by that tag. All data stays on your device — nothing is sent anywhere.

## Features

- Add log entries with a time-of-day tag, suggested automatically from the clock
  - Default ranges: Morning 5am–12pm, Noon 12pm–5pm, Evening 5pm–9pm, Night 9pm–5am
  - Tap any option to override the suggestion, or tap the selected one again to clear it
  - Change the ranges yourself under "Time-of-day settings" — set when each period starts, or reset to the defaults
- Filter entries by time of day
- Edit or delete any entry
- Export your logs to a JSON file, or import a previous export
- Installable as a home-screen app (PWA)
- High-contrast, accessible design

## Files

- `index.html` — page structure
- `style.css` — styling
- `app.js` — app logic (storage, rendering, form handling)
- `manifest.json` — PWA manifest
- `icons/` — home-screen icons

## Data & privacy

Entries are stored only in your browser's local storage on your device. Nothing is uploaded or shared. Use the Export button under "Backup & data" to save a copy, or Import to restore one.

## About

This project is non-profit and was built with the help of AI.
