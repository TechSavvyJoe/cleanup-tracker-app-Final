# Cleanup Tracker Mobile

React Native (Expo) companion app for the Cleanup Tracker project. It lets you exercise core flows in the iOS Simulator while reusing the existing Node/Express backend.

## Prerequisites

- Node.js 18+
- Yarn or npm (Expo CLI works with either)
- Xcode with iOS Simulator installed
- Cleanup Tracker backend running locally (`cd server && node server.js`)

## Getting Started

```bash
cd mobile
npm install           # or yarn
npm run start         # launches Expo dev server
```

The Expo CLI opens a developer menu in the terminal. To launch the iOS simulator:

```bash
npm run ios
```

Expo will build a development client and open the simulator. If this is your first run it may take several minutes.

## Connecting to the Backend

The app reads the API base URL from `app.json` (`expo.extra.apiBaseUrl`). Update it if your backend lives on a different host. When using the iOS simulator, the host machine’s LAN IP is usually easier than `localhost`.

Example:

```json
"extra": {
  "apiBaseUrl": "http://192.168.68.118:5051"
}
```

You can also change the value inside the app’s settings card at runtime.

## Test Credentials

Reuse the seeded users from the web app, e.g.

| Role      | Name         | PIN  |
|-----------|--------------|------|
| Manager   | Joe Gallant  | 1701 |
| Detailer  | Alfred       | 1716 |
| Detailer  | Brian        | 1709 |
| Sales     | Sarah Johnson| 2001 |

## Useful Notes

- The React Native app talks to the same `/api/v2` routes as the web client.
- Leave the backend server running in its own terminal so Expo can reach it.
- If you need fast-refresh during development, keep the Expo terminal in focus and avoid running other commands in it.
