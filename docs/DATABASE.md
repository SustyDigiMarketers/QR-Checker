# CleanCheck Database Schema & Architecture Manual (v1.0.0)

This document outlines the database architecture, schema properties, Mongoose models, and storage specifications for CleanCheck v1.0.0.

---

## 🏛️ Database Engine & System of Record

- **MongoDB Atlas**: Primary operational database (System of Record). MongoDB stores all relational facility data, user credentials, assignments, inspections, audit logs, and system settings.
- **Mongoose ORM Models**: Data schemas are enforced using Mongoose ORM models in `/models/index.ts`.
- **Fail-Fast Production Constraint**: In production (`NODE_ENV=production`), the application enforces connection to `MONGODB_URI` at startup and terminates (`process.exit(1)`) if unavailable.

---

## 🗄️ MongoDB Collections & Schema Data Dictionary

### 1. `users`
- **Fields**:
  - `id` (String, required, unique): Custom prefix ID (e.g. `usr-...`).
  - `username` (String, required, unique, lowercase).
  - `email` (String, required).
  - `fullName` (String, required).
  - `role` (String, required): `'super_admin' | 'manager' | 'inspector'`.
  - `organizationId` (String, optional): Parent organization reference.
  - `passwordHash` (String, required): PBKDF2 SHA-512 hashed password.
  - `salt` (String, required): Cryptographic salt.
  - `active` (Boolean, default: true).
  - `deletedAt` (Date, optional): Soft-delete timestamp.

### 2. `organizations`
- **Fields**:
  - `id` (String, required, unique): Custom prefix ID (`org-...`).
  - `name` (String, required).
  - `code` (String, required, uppercase).
  - `address` (String).
  - `contactEmail` (String).
  - `active` (Boolean, default: true).
  - `deletedAt` (Date, optional).

### 3. `buildings`
- **Fields**:
  - `id` (String, required, unique): Custom prefix ID (`bld-...`).
  - `organizationId` (String, required, indexed).
  - `name` (String, required).
  - `address` (String).
  - `deletedAt` (Date, optional).

### 4. `floors`
- **Fields**:
  - `id` (String, required, unique): Custom prefix ID (`flr-...`).
  - `buildingId` (String, required, indexed).
  - `name` (String, required).
  - `level` (Number, default: 0).
  - `deletedAt` (Date, optional).

### 5. `rooms`
- **Fields**:
  - `id` (String, required, unique): Custom prefix ID (`rm-...`).
  - `floorId` (String, required, indexed).
  - `name` (String, required).
  - `qrToken` (String, required, indexed): Secure cryptographically random verification token.
  - `active` (Boolean, default: true).
  - `deletedAt` (Date, optional).

### 6. `inspections`
- **Fields**:
  - `id` (String, required, unique): Custom prefix ID (`ins-...`).
  - `receiptNumber` (String, required, unique): Unique compliance receipt (e.g. `CC-20260721-123456`).
  - `roomId` (String, required, indexed).
  - `inspectorId` (String, required, indexed).
  - `organizationId` (String, required, indexed).
  - `cleaned` (Boolean, required).
  - `rating` (Number, min: 1, max: 5).
  - `remarks` (String).
  - `photoUrl` (String): Private Cloudflare R2 object reference (`/api/media/uploads/photo-...`).
  - `signatureUrl` (String): Private Cloudflare R2 object reference (`/api/media/uploads/sig-...`).
  - `latitude` / `longitude` (Number, optional): GPS geolocation stamps.
  - `deviceTime` (Date, required).
  - `createdAt` (Date, default: Date.now).

### 7. `audit_logs`
- **Fields**:
  - `id` (String, required, unique): Custom prefix ID (`aud-...`).
  - `userId` (String, required, indexed).
  - `username` (String, required).
  - `action` (String, required).
  - `details` (String).
  - `ipAddress` (String).
  - `createdAt` (Date, default: Date.now).

---

## 💾 Daily Snapshots & R2 Persistence

- **Daily Backup Scheduler**: Every 24 hours, the server exports all database collections into a structured JSON snapshot and uploads it to Cloudflare R2 under `backups/backup-auto-YYYY-MM-DD-HH-mm-ss.json`.
- **Retention**: Snapshots older than 30 days are automatically pruned.
