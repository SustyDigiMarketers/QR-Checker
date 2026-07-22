# Production Deployment Checklist (v1.0.0)
## Architecture: GitHub → Render → MongoDB Atlas → Cloudflare R2 → Cloudflare DNS

This checklist covers the strict, ordered sequence of operations required to deploy CleanCheck v1.0.0 into production.

---

## 🏁 Phase 1: Database & Storage Setup

*   [ ] **MongoDB Atlas Cluster**:
    *   [ ] Create dedicated database user `cleancheck_app_user` with `readWrite` permissions on `cleancheck` database.
    *   [ ] Verify cluster connection string uses TLS (`ssl=true` or `retryWrites=true&w=majority`).
    *   [ ] Add `0.0.0.0/0` (or Render static outbound IPs) to Atlas Network Access rules.
*   [ ] **Cloudflare R2 Bucket**:
    *   [ ] Create private bucket `cleancheck-storage`.
    *   [ ] Generate R2 API credentials (Access Key ID and Secret Access Key).
    *   [ ] Verify public bucket access is **Disabled**.

---

## 🚀 Phase 2: Render Web Service Provisioning

*   [ ] Connect GitHub repository to Render Dashboard using Blueprint (`render.yaml`).
*   [ ] Inject production environment variables into Render Environment Settings:
    *   [ ] `NODE_ENV=production`
    *   [ ] `PORT=3000`
    *   [ ] `MONGODB_URI=mongodb+srv://cleancheck_app_user:<PASSWORD>@.../cleancheck?retryWrites=true&w=majority`
    *   [ ] `APP_URL=https://cleancheck.yourdomain.com`
    *   [ ] `S3_BUCKET=cleancheck-storage`
    *   [ ] `S3_REGION=auto`
    *   [ ] `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
    *   [ ] `S3_ACCESS_KEY_ID=<R2_ACCESS_KEY_ID>`
    *   [ ] `S3_SECRET_ACCESS_KEY=<R2_SECRET_ACCESS_KEY>`
    *   [ ] `CORS_ORIGINS=https://cleancheck.yourdomain.com`
    *   [ ] `RENDER_DEPLOY_HOOK_URL=<RENDER_HOOK_URL>` (added to GitHub Repository Secrets)
*   [ ] Verify build succeeds (`npm install && npm run build`).
*   [ ] Verify `/api/health` returns HTTP 200 (`"status": "UP"`).

---

## 🌐 Phase 3: Custom Domain & Cloudflare DNS

*   [ ] Add `cleancheck.yourdomain.com` in Render Custom Domains.
*   [ ] Add `CNAME` record in Cloudflare DNS pointing `cleancheck` to `<render-app>.onrender.com` with Proxy enabled (Orange Cloud).
*   [ ] Set Cloudflare SSL/TLS mode to **Full (Strict)** and enable **Always Use HTTPS**.

---

## 🧪 Phase 4: Live Verification & Acceptance Testing

*   [ ] Verify `/api/health` returns `200 OK` with database latency metrics.
*   [ ] Test Super Admin, Manager, and Inspector logins.
*   [ ] Test Organization, Building, Floor, and Room CRUD.
*   [ ] Test mobile inspection submission with photo attachment & signature upload.
*   [ ] Verify uploaded photo/signature resolves through authenticated presigned media route `/api/media/uploads/:filename`.
*   [ ] Test offline inspection submission in IndexedDB and automatic sync on reconnection.
*   [ ] Trigger manual backup in Admin Settings and verify backup JSON snapshot uploaded to Cloudflare R2 `backups/`.
*   [ ] Test database restore with `"confirmRestore": true` safety flag.
*   [ ] Test PDF, Excel, and CSV report exports.
*   [ ] Verify audit log entries recorded for admin actions.
