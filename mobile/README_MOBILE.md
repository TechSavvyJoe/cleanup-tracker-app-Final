# Cleanup Tracker Mobile App

React Native mobile app built with Expo for iOS and Android.

## Current Status

✅ App structure complete
✅ All dependencies installed
✅ Assets (icons, splash screen) ready
✅ API integration implemented
⚠️ Package version mismatch (needs update)

## Quick Start

### Prerequisites

1. **Node.js 18+** (already installed ✅)
2. **iOS Simulator** (Xcode required for Mac)
3. **Android Emulator** (Android Studio required)
4. **Backend Server Running** on http://localhost:5051

### Option 1: Start with Expo Go (Easiest)

```bash
cd "/Users/missionford/cleanup-tracker-app Final/mobile"

# Start Expo development server
npx expo start

# Then:
# - For iOS: Press 'i' to open iOS simulator
# - For Android: Press 'a' to open Android emulator
# - For phone: Scan QR code with Expo Go app
```

### Option 2: Build and Run Native Apps

#### iOS (Mac only)

```bash
cd "/Users/missionford/cleanup-tracker-app Final/mobile"

# Start iOS simulator
npx expo run:ios

# Or specify device
npx expo run:ios --device
```

#### Android

```bash
cd "/Users/missionford/cleanup-tracker-app Final/mobile"

# Start Android emulator (must be running first)
npx expo run:android
```

## Package Version Issues

Your app has some package version mismatches. To fix:

```bash
cd "/Users/missionford/cleanup-tracker-app Final/mobile"

# Option 1: Auto-fix (recommended)
npx expo install --fix

# Option 2: Manual update
npx expo install react-native-screens@3.31.1
npx expo install react-native-svg@15.2.0
```

## App Configuration

### API URL Configuration

The app automatically detects the correct API URL:

- **iOS Simulator**: http://127.0.0.1:5051
- **Android Emulator**: http://10.0.2.2:5051
- **Physical Device**: Configure in app settings

### Current Configuration (app.json)

```json
{
  "expo": {
    "name": "Cleanup Tracker",
    "slug": "cleanup-tracker",
    "ios": {
      "bundleIdentifier": "com.cleanuptracker.app"
    },
    "android": {
      "package": "com.cleanuptracker.app"
    }
  }
}
```

## Features

✅ **Authentication**: PIN-based login (uses same PINs as web app)
✅ **Dashboard**: Real-time job statistics and charts
✅ **Jobs**: Create, view, and manage cleanup jobs
✅ **QC Mode**: Quality control workflow for managers
✅ **VIN Scanner**: Camera-based barcode scanning
✅ **Vehicle Search**: Search inventory by VIN/stock number
✅ **Reports**: View completion metrics and analytics
✅ **Settings**: Configure API URL and preferences

## Test Users

Same as web app:

| Name | Role | PIN |
|------|------|-----|
| Joe Gallant | Manager | 1701 |
| Alfred | Detailer | 1716 |
| Brian | Detailer | 1709 |

## Troubleshooting

### Metro Bundler Won't Start

```bash
# Clear cache and restart
cd "/Users/missionford/cleanup-tracker-app Final/mobile"
npx expo start --clear
```

### Can't Connect to Backend

1. Make sure backend is running: `curl http://localhost:5051/api/health`
2. For Android emulator, use http://10.0.2.2:5051
3. For physical device, use your computer's IP address

### iOS Simulator Not Opening

```bash
# Install iOS simulator
xcode-select --install

# Open simulator manually
open -a Simulator

# Then press 'i' in Expo terminal
```

### Android Emulator Not Found

1. Install Android Studio
2. Open AVD Manager
3. Create/start an emulator
4. Then run: `npx expo run:android`

## File Structure

```
mobile/
├── src/
│   ├── App.js              # Main app component
│   ├── api/                # API integration
│   │   ├── auth.js
│   │   ├── jobs.js
│   │   ├── vehicles.js
│   │   ├── reports.js
│   │   └── settings.js
│   ├── context/            # React Context
│   │   └── SessionContext.js
│   └── theme/              # Colors and styles
│       └── colors.js
├── assets/                 # Icons and images
├── app.json               # Expo configuration
├── package.json           # Dependencies
└── index.js              # Entry point
```

## Development Tips

### Hot Reload

Changes automatically reload in the app. If not:
- Shake device (physical)
- Press Cmd+D (iOS simulator)
- Press Cmd+M (Android emulator)

### Debugging

```bash
# View logs
npx expo start

# Then press 'j' to open debugger
```

### Build for Production

#### iOS

```bash
# Build for App Store
eas build --platform ios

# Or create local build
npx expo run:ios --configuration Release
```

#### Android

```bash
# Build APK
eas build --platform android --profile preview

# Or create local build
npx expo run:android --variant release
```

## API Integration

The app connects to the same backend as the web app:

- **Base URL**: http://localhost:5051
- **Endpoints**: `/api/v2/*`
- **Auth**: JWT tokens stored in AsyncStorage
- **Auto-refresh**: Tokens refresh automatically

## Screen Shots

(Add screenshots here after app is running)

## Next Steps

1. ✅ Backend running on http://localhost:5051
2. ⚠️ Fix package versions: `npx expo install --fix`
3. 🚀 Start app: `npx expo start`
4. 📱 Test on simulator: Press 'i' (iOS) or 'a' (Android)
5. ✨ Login with PIN 1701 (manager)

---

**Ready to test!** The backend is already running, just start the mobile app.
