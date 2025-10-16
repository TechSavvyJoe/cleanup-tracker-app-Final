# Cleanup Tracker – Enterprise Job Management

**Status:** ✅ Production Ready | 🎯 100% Test Pass Rate | 🔒 Security Audited

A comprehensive vehicle detailing and cleanup job management system with web and mobile interfaces, built for dealerships and service centers.

---

## 🚀 Quick Start

### Web Application
```bash
# Install dependencies
npm run install:all

# Start development servers (frontend + backend)
npm run dev

# Build for production
npm run build
npm start
```

### Mobile App (iOS/Android)
```bash
cd mobile
npm install
npm run ios      # iOS Simulator
npm run android  # Android Emulator
```

---

## 📋 Features

### ✨ Core Capabilities
- **Job Management** - Create, track, and complete vehicle cleanup jobs
- **User Management** - Role-based access (Manager, Detailer, Salesperson, QC)
- **Inventory Sync** - Import vehicle inventory from Google Sheets CSV
- **VIN Scanner** - QR, Code39, and Code128 barcode support
- **Real-time Updates** - Live job status and timer tracking
- **Reports & Analytics** - Generate Excel reports with job data
- **Mobile Support** - Native iOS/Android app via React Native/Expo

### 🎨 User Interfaces
- **Manager Dashboard** - Full oversight, analytics, user management
- **Detailer View** - Job assignment, timer, completion workflow
- **Salesperson Portal** - Job creation and status tracking
- **QC View** - Quality control and job verification

---

## 🏗️ Architecture

### Frontend (Web)
- **Framework:** React 18.2
- **Build Tool:** Create React App 5.0.1
- **State:** Redux + React Hooks
- **Routing:** React Router 6
- **UI:** Tailwind CSS, Custom Premium Components
- **Testing:** Jest + React Testing Library (28 tests, 100% pass rate)

### Backend (API)
- **Runtime:** Node.js + Express
- **Database:** MongoDB (Mongoose ODM)
- **Authentication:** JWT (access + refresh tokens)
- **Security:** Helmet, CORS, Rate Limiting, Input Validation
- **Logging:** Winston (daily rotation)
- **Error Handling:** Custom error classes with structured responses

### Mobile
- **Framework:** React Native 0.74.3
- **Platform:** Expo SDK 51.0.0
- **API Client:** Axios with JWT auth

---

## 📂 Project Structure

```
cleanup-tracker-app/
├── client/              # React web application
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── views/       # Feature-specific views
│   │   ├── pages/       # Route pages
│   │   ├── hooks/       # Custom React hooks
│   │   ├── utils/       # Utilities and helpers
│   │   └── styles/      # Theme and design system
│   └── package.json
├── server/              # Express API server
│   ├── routes/          # API endpoints
│   ├── models/          # MongoDB schemas
│   ├── middleware/      # Express middleware
│   ├── utils/           # Server utilities
│   └── package.json
├── mobile/              # React Native app
│   ├── src/
│   │   ├── api/         # API client
│   │   └── App.js       # Main app component
│   └── package.json
└── docs/                # Documentation
```

---

## 🔒 Security

**Status:** ✅ Production Approved

The application has been security audited. See [SECURITY_AUDIT.md](SECURITY_AUDIT.md) for details.

### Active Security Measures
- ✅ JWT authentication with refresh tokens
- ✅ Rate limiting (100 req/15min per IP)
- ✅ Helmet.js security headers
- ✅ Input validation and sanitization
- ✅ CORS with origin restrictions
- ✅ bcrypt password hashing
- ✅ MongoDB injection protection
- ✅ Structured error handling (no data leaks)

### Known Issues
- 5 moderate severity vulnerabilities (all documented and mitigated)
- Development-only webpack-dev-server advisory (not exploitable in production)
- See [SECURITY_AUDIT.md](SECURITY_AUDIT.md) for complete analysis

---

## 🗄️ Database Setup

### Persistent, synced data for everyone

Use a managed MongoDB (free tier) so all devices share the same data:

1. Create a free MongoDB Atlas cluster
2. Copy the connection string to `server/.env` as `MONGO_URI`
3. Deploy the server (Railway/Render/Fly) or run it on a machine with a public URL

Why Atlas? It's free (sandbox), easy, and reliable for a small team; data persists across devices and sessions.

---

## 📊 Inventory Source

Set `INVENTORY_CSV_URL` in `server/.env` to your published Google Sheet CSV.

The server imports on startup and on-demand at `POST /api/v2/vehicles/refresh`.

**Supported formats:**
- VIN, Make, Model, Year, Stock Number, Price, etc.
- Auto-populate job details from inventory on VIN scan

---

## 📱 VIN Scanner

The built-in scanner supports multiple barcode formats:

- **QR Codes** - Full VIN or data payload
- **Code39** - Standard 1D barcode (17-digit VINs)
- **Code128** - High-density 1D barcode
- **Native Detection** - Uses browser BarcodeDetector API when available
- **Fallback** - ZXing library for older browsers

---

## 🧪 Testing

**Status:** 28/28 tests passing ✅

```bash
cd client
npm test                    # Run tests
npm test -- --coverage      # With coverage report
npm run build              # Verify production build
```

**Test Coverage:**
- Overall: 15.19% (focused on critical paths)
- MySettingsView: 96.29%
- QCView: 87.09%
- UsersView: 76.19%

See [TEST_REPORT.md](TEST_REPORT.md) for detailed results.

---

## 📦 Deployment

### Supported Platforms
- ✅ **Cloudflare Pages** (via [wrangler.toml](wrangler.toml))
- ✅ **Railway** (via [railway.json](railway.json))
- ✅ **Render** (via [render.yaml](render.yaml))
- ✅ **Docker** (via [Dockerfile](Dockerfile))

See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for step-by-step deployment guide.

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [SECURITY_AUDIT.md](SECURITY_AUDIT.md) | Security vulnerabilities and mitigations |
| [ISSUES_RESOLVED.md](ISSUES_RESOLVED.md) | Recent fixes and improvements |
| [TEST_REPORT.md](TEST_REPORT.md) | Complete test results |
| [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) | Deployment guide |
| [mobile/README.md](mobile/README.md) | Mobile app setup and usage |
| [docs/CRA_MIGRATION_PLAN.md](docs/CRA_MIGRATION_PLAN.md) | Future tooling migration plan |

---

## 🛠️ Technology Stack

### Dependencies Highlights
- **exceljs** - Excel report generation (replaced vulnerable `xlsx`)
- **jspdf** - PDF generation
- **html5-qrcode** - Barcode scanning
- **axios** - HTTP client
- **jsonwebtoken** - JWT authentication
- **mongoose** - MongoDB ODM
- **winston** - Logging
- **express-validator** - Input validation

### Security & dependency notes

- Excel exports use `exceljs` to replace the vulnerable `xlsx` library
- We pin patched versions of `postcss`, `resolve-url-loader`, `webpack-dev-server` via npm overrides
- Create React App still bundles `webpack-dev-server` with an advisory (GHSA-9jgg-88mc-972h)
- **Mitigation:** Only affects development server; limit exposure to trusted networks
- **Future:** Consider migrating to Vite or Next.js (see [docs/CRA_MIGRATION_PLAN.md](docs/CRA_MIGRATION_PLAN.md))

---

## 🎯 Development Workflow

### Install Dependencies
```bash
npm run install:all
```

### Development
```bash
npm run dev              # Run both client and server
npm run dev:client       # Client only (port 3000)
npm run dev:server       # Server only (port 5051)
```

### Production Build
```bash
npm run build            # Build client
npm start                # Start production server
```

### Testing
```bash
cd client
npm test                 # Run tests
npm test -- --coverage   # With coverage
```

---

## 🔧 Environment Variables

### Server (.env)
```bash
NODE_ENV=production
PORT=5051
MONGODB_URI=mongodb://localhost:27017/cleanup-tracker
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
INVENTORY_CSV_URL=https://your-google-sheet-csv-url
CORS_ORIGIN=https://your-domain.com
```

See [.env.example](.env.example) for full configuration options.

---

## 📈 Project Stats

- **Total Files:** 150+ source files
- **Lines of Code:** ~25,000 (client + server + mobile)
- **Test Suites:** 7 test suites
- **Tests:** 28 tests (100% passing)
- **Dependencies:** 1,400+ (client), 230+ (server), 1,200+ (mobile)
- **Bundle Size:** 120.45 kB (gzipped JS) + 19.9 kB (gzipped CSS)

---

## 🤝 Contributing

1. Review [SECURITY_AUDIT.md](SECURITY_AUDIT.md) for security guidelines
2. Ensure all tests pass before submitting PR
3. Follow existing code style (ESLint configured)
4. Update documentation for new features

---

## 📄 License

Private - All Rights Reserved

---

## 🚀 Ready for Production!

**Current Status:** ✅ All systems operational

- ✅ 28/28 tests passing
- ✅ Zero build warnings
- ✅ Security audited and approved
- ✅ Production build optimized
- ✅ Documentation complete
- ✅ Mobile app ready

**Deploy now!** See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)
