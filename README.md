# Cleanup Tracker – Persistence & Inventory

This app imports your used inventory from a published Google Sheet (CSV) and stores jobs/users/inventory in MongoDB.

## Persistent, synced data for everyone

Use a managed MongoDB (free tier) so all devices share the same data:

- Create a free MongoDB Atlas cluster.
- Copy the connection string to `server/.env` as `MONGO_URI`.
- Deploy the server (Railway/Render/Fly/Heroku alternative) or run it on a machine with a public URL.

Why Atlas? It’s free (sandbox), easy, and reliable for a small team; data persists across devices and sessions.

## Inventory source

Set `INVENTORY_CSV_URL` in `server/.env` to your published Google Sheet CSV. The server imports on startup and on-demand at `POST /api/v2/vehicles/refresh`.

## Scanner

The built-in scanner supports QR, Code39, and Code128 via native `BarcodeDetector` or ZXing fallback. It parses VINs from QR payloads and supports long 1D barcodes.

## Security & dependency notes

- Excel exports now rely on `exceljs` to replace the vulnerable `xlsx` library (prototype pollution / ReDoS advisories). If you still have utilities built on SheetJS, migrate them to the new helper in `client/src/components/SimpleReports.js`.
- We pin patched versions of `postcss`, `resolve-url-loader`, `webpack-dev-server`, and related dependencies through npm overrides, but Create React App still bundles `webpack-dev-server` with an open advisory (GHSA-9jgg-88mc-972h). Limit exposure of the dev server in untrusted networks and consider migrating to a modern toolchain (e.g. Vite or Next.js) when possible.
- A detailed transition plan is available in `docs/CRA_MIGRATION_PLAN.md`.
