# CleanCheck System Architecture & Design Manual (v1.0.0)

This document provides an architectural overview of the CleanCheck multi-tenant facility management platform.

---

## 🗺️ High-Level System Architecture

CleanCheck is built as a single-service full-stack web application. It integrates a React 18 Single Page Application (SPA) with an Express Node.js backend running on Render, backed by **MongoDB Atlas** as the operational system of record and **Cloudflare R2** for object storage.

```mermaid
graph TD
    %% Client Layer
    subgraph Client [React 18 SPA Browser Client]
        UI[Dashboards & Portals]
        Cam[QR Camera Scanner]
        Sig[Signature Pad Canvas]
        LocalState[IndexedDB & React State]
    end

    %% Backend Server
    subgraph Server [Express Node.js Server on Render]
        Router[Express API Router /api/*]
        ViteMid[Vite Dev Middleware]
        StaticServ[Static Bundle Server]
        MediaProxy[Authenticated Media Proxy]
        BackupWorker[Daily Backup Scheduler]
    end

    %% Cloud Infrastructure
    subgraph Cloud [Production Cloud Infrastructure]
        MongoDB[(MongoDB Atlas DB)]
        R2[(Private Cloudflare R2)]
        CloudflareDNS[Cloudflare DNS & SSL]
    end

    %% Connections
    UI -->|HTTPS Requests| CloudflareDNS
    CloudflareDNS -->|Proxy| Router
    Router <-->|Mongoose Driver| MongoDB
    Router <-->|AWS S3 SDK| R2
    MediaProxy -->|Presigned URLs| R2
    BackupWorker -->|Daily Snapshots| R2

    classDef client fill:#eef2f3,stroke:#333,stroke-width:2px;
    classDef server fill:#d9e2ec,stroke:#102a43,stroke-width:2px;
    classDef cloud fill:#ffebec,stroke:#610b11,stroke-width:2px;
    
    class Client,UI,Cam,Sig,LocalState client;
    class Server,Router,ViteMid,StaticServ,MediaProxy,BackupWorker server;
    class Cloud,MongoDB,R2,CloudflareDNS cloud;
```

---

## 🛠️ Express + Vite Single Engine Architecture

CleanCheck is bundled as a single, unified codebase:

1. **Vite Dev Middleware**: In development mode (`NODE_ENV !== "production"`), Express dynamically mounts Vite middleware for HMR and asset serving on port `3000`.
2. **Production Compilation**: When running `npm run build`, `esbuild` bundles `/server.ts` into a standalone CommonJS file `dist/server.cjs` and Vite builds client-side static bundles inside `dist/`.
3. **Production Server**: In production (`npm start`), Express directly serves `dist/index.html` and static assets from `dist/`, handling `/api/*` requests natively.

---

## 🗄️ Database & Storage Engine

- **MongoDB Atlas**: Primary operational database storing users, organizations, facility hierarchies (buildings/floors/rooms), QR codes, assignments, inspections, audit logs, and settings.
- **Cloudflare R2 Object Storage**: Private S3-compatible storage engine for uploaded photos, signature assets, and daily JSON database snapshots.
- **Private Access Control**: Media references are stored as `/api/media/uploads/:filename`. Requesting users are authenticated, and presigned S3 URLs (15-min expiry) are generated dynamically for authorized users.

---

## 🔄 Offline Inspection & Synchronization

- **Client IndexedDB Buffering**: When field inspectors lose network connectivity, inspections are stored locally in browser IndexedDB with queued sync actions.
- **Automatic Reconnection Flush**: When connectivity is restored, queued offline submissions are posted to `/api/inspections` automatically.
- **Idempotency & Deduplication**: Inspection receipts and room tokens prevent duplicate record creation.
