# CleanCheck v1.0.0 — 10-Minute Developer Onboarding

Welcome to the **CleanCheck** development and operations guide. This document is designed to get any incoming developer, system administrator, or site reliability engineer (SRE) up to speed with the codebase, deployment flow, and routine maintenance tasks in under 10 minutes.

---

## 1. Technology Stack

CleanCheck is a full-stack, enterprise-grade facilities inspection application designed with an offline-first architecture.

*   **Frontend**: React 18+ (SPA), Vite, Tailwind CSS, Lucide Icons, and Framer Motion (`motion/react`).
*   **Backend**: Node.js, Express, TypeScript (transpiled to CJS with `esbuild` for production).
*   **Database & Auth**: Google Firebase (Firestore for transactional records, Firebase Auth/Custom JWTs for session validation).
*   **External Integrations**: Google Sheets API v4 (real-time data streaming of approved inspections).
*   **Containerization**: Docker & Docker Compose (single-container deployment containing both the static frontend and the Express proxy backend).

---

## 2. Project Structure

Here is where the core architectural patterns and business logic reside:

```
CleanCheck/
├── docs/                      # Technical specification manuals
│   ├── API.md                 # Express REST endpoint contracts
│   ├── ARCHITECTURE.md        # Offline engine & RBAC diagrams
│   ├── DATABASE.md            # Firestore schema and collections
│   ├── DEPLOYMENT.md          # Multi-environment hosting guides
│   └── USER_GUIDE.md          # User manuals for Admins, Managers, & Inspectors
├── src/                       # Frontend SPA (React + TypeScript)
│   ├── App.tsx                # App shell, routing, global auth & sync state
│   ├── types.ts               # Shared TypeScript schemas (Inspections, Rooms, Users)
│   ├── index.css              # Core typography and Tailwind styles
│   └── components/            # UI Panels (tabs mapped to RBAC roles)
│       ├── InspectorPortal.tsx# Core inspector dashboard (offline queue & submission)
│       ├── ScannerTab.tsx     # QR code scanner component using camera
│       ├── QrCodeTab.tsx      # QR code generation & PDF layout engine
│       ├── DashboardTab.tsx   # Aggregated metrics for managers
│       └── Sidebar.tsx        # Responsive navigation rail
├── server.ts                  # Production Express API Server (Auth, Firestore, Sheets, Mail)
├── firestore.rules            # Firestore security rules enforcing RBAC
├── firestore.indexes.json     # Compound indexes for fast, sorted queries
└── firebase.json              # Firebase CLI deployment configuration
```

---

## 3. Environment Variables

Create a `.env` file in the root directory. **Never commit this file to source control.**

| Variable | Required | Default | Description / Example |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | `production` | Set to `development` or `production`. |
| `PORT` | No | `3000` | Port the Express application binds to. |
| `JWT_SECRET` | Yes | — | Cryptographic secret for signing session tokens (e.g., `cc_prod_3b8a1c9d...`). |
| `FIREBASE_PROJECT_ID` | Yes | — | Your Firebase/Google Cloud Project ID. |
| `GOOGLE_CLIENT_EMAIL` | Yes | — | Service Account email with Firestore & Google Sheets access. |
| `GOOGLE_PRIVATE_KEY` | Yes | — | Service Account private key (`-----BEGIN PRIVATE KEY-----\n...`). |
| `GOOGLE_SHEETS_ID` | Yes | — | Target Spreadsheet ID to append inspection logs to. |
| `SMTP_HOST` | No | — | Outbound email relay server (for password resets/alerts). |
| `SMTP_PORT` | No | `587` | Outbound email port (usually 587 or 465). |
| `SMTP_USER` | No | — | Username for SMTP authentication. |
| `SMTP_PASS` | No | — | Password for SMTP authentication. |

---

## 4. Production Deployment

CleanCheck is completely self-contained within Docker. To build and launch a fresh, production-grade instance:

```bash
# 1. Spin down any existing container volumes
docker compose down -v

# 2. Build the production image from scratch without caching
docker compose build --no-cache

# 3. Boot the container detached in the background
docker compose up -d

# 4. Stream real-time container logs
docker compose logs -f
```

---

## 5. Common Maintenance Tasks

### 🔑 Resetting User Passwords (CLI)
Since passwords are salted and hashed on the backend, password resets should be initiated via SMTP or directly updated in Firestore.
To manually trigger a reset for an Inspector or Manager in Firestore:
1. Navigate to the `users` collection.
2. Locate the user document by `email`.
3. Clear the `passwordHash` field or update it to a temporary bcrypt hash.

### 💾 Backup and Restore Databases
Firestore supports automated export/import through the Google Cloud SDK:
```bash
# Backup: Export Firestore collections to Google Cloud Storage (GCS)
gcloud firestore export gs://[YOUR_BACKUP_BUCKET]/cleancheck-backup-$(date +%F)

# Restore: Import from a previous snapshot
gcloud firestore import gs://[YOUR_BACKUP_BUCKET]/cleancheck-backup-[TIMESTAMP]/
```

### 🛡️ Deploying Security Rules & Indexes
To push your security rules or indexes directly to your active Firebase project without using a local environment CLI:
```bash
# Deploys firestore.rules & firestore.indexes.json to the active project
firebase deploy --only firestore
```

### 📋 Viewing Server Logs
```bash
# Follow live container output
docker logs -f cleancheck-app

# Search for specific synchronization errors or database timeouts
docker logs cleancheck-app | grep -i "error"
```

---

## 6. Known Limits & Boundaries

When scaling CleanCheck, be aware of the following architectural and platform limits:

1.  **Offline Queue Size**: Offline inspections are temporarily stored in the browser's `localStorage` (typically capped at 5MB). A standard inspection takes roughly `2KB` of JSON data; this allows an Inspector to queue over **2,000 pending inspections** before experiencing storage saturation. Note that photo/file attachments are not supported offline to preserve storage.
2.  **Google Sheets Quota**: The Google Sheets API has a standard read/write rate limit of **300 requests per minute per project**. To prevent rate-limiting when multiple inspections are approved simultaneously, backend synchronization is debounced and batched before writing to the Sheet.
3.  **Firestore Write Limits**: Firebase limits document writes to **10,000 per second** per database, which far exceeds the administrative limits of any standard facilities application.
4.  **Browser & OS Compatibility**: The offline sync engine relies on modern browser APIs (`localStorage`, `navigator.onLine`, and `fetch`). The QR scanner requires secure contexts (`HTTPS`) to obtain permission to access the device's camera.
