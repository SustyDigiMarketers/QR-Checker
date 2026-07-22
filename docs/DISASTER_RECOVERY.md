# CleanCheck Enterprise Disaster Recovery Manual (v1.0.0)

This document outlines the standard operating procedures (SOP) for disaster recovery, fault isolation, and self-healing mechanisms integrated into the CleanCheck platform.

---

## 🗄️ 1. MongoDB Connection Loss & Automatic Reconnection

CleanCheck utilizes `mongoose` and native MongoDB drivers configured with robust reconnection, exponential backoff, and local memory failover strategies.

### 1.1 Automated Recovery Design
*   **Buffer Max Entries**: Configured to hold requests in memory during brief database drops.
*   **Exponential Backoff**: If MongoDB goes offline, CleanCheck initiates a reconnection loop that scales backoff duration to prevent server throttling or CPU exhaustion.
*   **Failover (Read-Only/In-Memory Mode)**: If the system completely loses contact with MongoDB, the database engine falls back gracefully into memory cached arrays for state tracking, which guarantees that active, on-site Housekeeping Inspectors can continue their current shifts without application crash screens.

### 1.2 Verification and Troubleshooting
1. Check the database connection status via the telemetry health endpoint:
   ```bash
   curl http://localhost:3000/api/health
   ```
2. Inspect the live application container logs for retry telemetry:
   ```bash
   docker logs cleancheck_platform | grep "MongoDB"
   ```
3. To manually force a reconnect check without restarting the server:
   ```bash
   # Test TCP socket connection to MongoDB host
   nc -zv -w5 <your_mongodb_host> 27017
   ```

---

## 💾 2. Local Storage & Uploads Folder Recovery

CleanCheck depends on the presence of a `/uploads` directory on disk to store captured evidence photos and inspector hand signatures.

### 2.1 Missing Uploads Directory Self-Healing
On boot, the Express application executes synchronous directory verification:
```typescript
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log(`[Self-Healing] Regenerated missing uploads directory: ${UPLOADS_DIR}`);
}
```
If the folder is accidentally deleted during runtime, the upload controller will automatically re-verify and re-create the directory prior to writing base64 image streams.

### 2.2 Storage Volume Permissions Recovery
If you see file-write errors in the application log (`EACCES: permission denied, open '/app/uploads/'`):
1. Correct ownership of the mounted volume on the host system:
   ```bash
   chown -R 1000:1000 ./uploads
   chmod -R 755 ./uploads
   ```
2. Verify Docker bind mount configuration inside `docker-compose.yml`.

---

## 💾 3. Backups and Database Recovery

CleanCheck ships with built-in backup and restore utilities to secure state across bare-metal or cloud failures.

### 3.1 Restoring From an Archive
To restore the platform to a verified snapshot, execute the restore shell script:
```bash
./scripts/restore.sh ./backups/cleancheck_backup_2026_07_19.tar.gz
```
The script will perform the following safe recovery operations:
1. Verify the integrity and format of the target tar.gz archive.
2. Unpack assets, local database cache files, and `.env` credentials.
3. Reload active cached sessions into memory without forcing active users to re-authenticate.

### 3.2 Handling a Corrupted Backup File
If the recovery script fails with a `Gzip: invalid header` or checksum mismatch error:
1. Do NOT attempt to extract the corrupted archive over an existing live directory.
2. Run an integrity check on the tarball:
   ```bash
   tar -tzf ./backups/cleancheck_backup_corrupted.tar.gz
   ```
3. Locate the redundant, historical backups located under the `/backups` directory. CleanCheck retains up to 7 historical snapshots by default.
4. If recovering database-level collections only, use the native MongoDB `mongorestore` tool against the raw dump files if present.

---

## ⚡ 4. Low Disk Space Protocol

When the host system drops below critical disk storage thresholds, log file writes and database persistence can fail.

### 4.1 Automated Log Rotation
To prevent container log bloat from consuming available volume space, the Docker logging driver is hard-capped inside `docker-compose.yml`:
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```
This restricts the total logging footprint per container to a maximum of 30MB.

### 4.2 Active Cleanup Protocol
If the disk occupancy exceeds 90%, execute the following maintenance checklist:
1. Clear dangling Docker images, volumes, and build caches:
   ```bash
   docker system prune -a --volumes --force
   ```
2. Remove old, orphaned uploads inside the application (CleanCheck runs an automated daily cleanup loop for temporary upload files).
3. Move historical backup archives from the local `/backups` directory to an off-site secure S3 or Google Cloud Storage bucket.

---

## 🐋 5. Docker Service Self-Healing & Restarts

To guarantee high availability and self-healing under unexpected OS failures or severe memory pressure, the CleanCheck container is armed with an automatic restart policy.

### 5.1 Restart Policy Configuration
Inside `docker-compose.yml`, the restart configuration is set to:
```yaml
restart: unless-stopped
```
This instructs the Docker daemon to:
*   Automatically reboot the CleanCheck server if it exits due to an unhandled exception or Node out-of-memory (OOM) crash.
*   Automatically launch the CleanCheck portal upon host system reboots (e.g., following OS patches or cloud hypervisor migrations).

### 5.2 Health Checks & Container Re-indexing
To enable Docker's native container health monitoring, configure the following health check parameters inside your deployment profile:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```
If the container health endpoint fails 3 consecutive times, the container will be flagged as unhealthy, notifying cloud schedulers to replace or recycle the container instance.
