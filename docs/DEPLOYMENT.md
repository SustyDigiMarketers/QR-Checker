# CleanCheck v1.0.0 Production Deployment Guide
## Architecture: GitHub → Render Web Service → MongoDB Atlas → Cloudflare R2 → Cloudflare DNS

This document provides complete instructions for deploying and operating CleanCheck v1.0.0 in production using **Render**, **MongoDB Atlas**, **Cloudflare R2**, and **Cloudflare DNS**.

---

## 🏗️ 1. Architecture Overview

CleanCheck v1.0.0 uses a modern, containerless full-stack architecture running on **Render Web Services**:

- **Runtime & App Hosting**: Render Web Service running Node.js ESM/CJS server (`node dist/server.cjs`) listening on Render's dynamic `PORT`.
- **Database (System of Record)**: MongoDB Atlas cluster with TLS enforcement and least-privilege SCRAM-SHA-256 user authentication.
- **Object Storage (Files & Backups)**: Private Cloudflare R2 bucket (`cleancheck-storage`) storing inspection photos, signatures, and daily backup JSON snapshots. Access is restricted to backend presigned URLs (15-min expiry) or authenticated media routes (`/api/media/uploads/:filename`).
- **DNS & CDN**: Cloudflare DNS with SSL/TLS set to Full (Strict) and "Always Use HTTPS" enabled.
- **CI/CD Pipeline**: GitHub Actions triggering Render Deploy Hook on pushes to `main` branch or release tags (`v*`).

---

## 🗄️ 2. MongoDB Atlas Configuration

1. **Create Database Cluster**:
   - Provision a M0/M10+ cluster on MongoDB Atlas.
2. **Database User Setup**:
   - Create a dedicated database user (e.g., `cleancheck_app_user`) with `readWrite` access restricted specifically to the `cleancheck` database.
   - **SECURITY RULE**: Do NOT use an Atlas cluster admin account (`atlasAdmin`) in production.
3. **Network Access**:
   - Add `0.0.0.0/0` in Atlas Network Access to allow Render dynamic IP addresses, or attach a Render Static Outbound IP and allowlist only those specific IPs.
4. **Connection String**:
   - Construct the connection string with TLS enabled (`ssl=true` or `retryWrites=true&w=majority`):
     ```env
     MONGODB_URI="mongodb+srv://cleancheck_app_user:<PASSWORD>@cluster0.x1y2z.mongodb.net/cleancheck?retryWrites=true&w=majority"
     ```

---

## ☁️ 3. Cloudflare R2 Object Storage Setup

1. **Create Bucket**:
   - Create a bucket named `cleancheck-storage` in Cloudflare R2.
2. **Bucket Visibility**:
   - Keep bucket access **Private** (do NOT enable public bucket URL).
3. **API Credentials**:
   - Create an R2 API Token with **Object Read & Write** permissions.
   - Copy Access Key ID, Secret Access Key, and Account Endpoint (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`).
4. **Environment Variables**:
   ```env
   S3_BUCKET="cleancheck-storage"
   S3_REGION="auto"
   S3_ENDPOINT="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
   S3_ACCESS_KEY_ID="<R2_ACCESS_KEY_ID>"
   S3_SECRET_ACCESS_KEY="<R2_SECRET_ACCESS_KEY>"
   S3_PUBLIC_URL="" # Empty to enforce authenticated presigned media proxying
   ```

---

## 🚀 4. Render Web Service Deployment

CleanCheck includes a `render.yaml` configuration file at the repository root.

### 4.1 Deployment Steps via Render Dashboard
1. Log into [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Blueprints**.
3. Connect your GitHub repository (`CleanCheck`).
4. Render will detect `render.yaml` and provision the Web Service automatically.
5. In **Environment Secrets / Variables**, configure the sensitive parameters:
   - `MONGODB_URI`
   - `S3_ACCESS_KEY_ID`
   - `S3_SECRET_ACCESS_KEY`
   - `S3_ENDPOINT`
   - `APP_URL` (`https://cleancheck.yourdomain.com`)
   - `CORS_ORIGINS` (`https://cleancheck.yourdomain.com`)
6. Deploy the service.

### 4.2 Build & Start Commands
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start` (`node dist/server.cjs`)
- **Health Check Path**: `/api/health`

---

## 🌐 5. Custom Domain & Cloudflare DNS Configuration

1. **Add Custom Domain in Render**:
   - Go to Web Service Settings -> **Custom Domains** -> Add `cleancheck.yourdomain.com`.
2. **Cloudflare DNS Records**:
   - Type: `CNAME`
   - Name: `cleancheck`
   - Target: `<your-render-subdomain>.onrender.com`
   - Proxy status: **Proxied** (Orange Cloud).
3. **Cloudflare SSL/TLS Settings**:
   - Mode: **Full (Strict)**.
   - Enable **Always Use HTTPS**.

---

## 💾 6. Automated Backups & Disaster Recovery

### Automated Backup Pipeline
- **Daily Execution**: Automated daily backup scheduler runs snapshot routine at 02:00 UTC.
- **R2 Storage**: Backup snapshots are written directly to private Cloudflare R2 under `backups/backup-auto-YYYY-MM-DD-HH-mm-ss.json`.
- **30-Day Retention**: Automated retention worker automatically purges snapshots older than 30 days from R2 storage.

### Restoration Procedure
1. Super Admin navigates to **Admin Settings -> System Backups -> Restore Snapshot** or calls `POST /api/admin/restore`.
2. **Safety Confirmation**: Payload must include `"confirmRestore": true` or header `X-Confirm-Restore: true`.
3. Restoration executes inside an isolated MongoDB transaction session, preserving all relational foreign keys, users, password hashes, inspections, and audit logs.

---

## 🔄 7. CI/CD Deployment & Rollbacks

- **Automated Deployments**: Pushing to `main` branch or tag push (`v*`) triggers GitHub Actions (`.github/workflows/deploy.yml`), which calls the Render Deploy Hook.
- **Rollback Procedure**: In Render Dashboard, go to **Events**, select a prior successful build, and click **Rollback to this deploy**.
