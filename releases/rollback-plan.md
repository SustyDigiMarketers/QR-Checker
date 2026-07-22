# Production Rollback & Contingency Plan (v1.0.0)

This plan outlines the emergency rollback procedures in case a production deployment of CleanCheck v1.0.0 encounters immediate critical errors (e.g., severe database corruption, constant synchronization crashes, or authentication blocks).

---

## 🚨 Emergency Contacts & Trigger Conditions
Execute this rollback plan **only** if:
*   Users are completely blocked from logging in (system-wide authentication failure).
*   Submitted audits are losing database records or corrupting files in production.
*   System degraded logs indicate a fatal Firestore permission or connection block that cannot be resolved within 30 minutes.

---

## ⏳ Step 1: Terminate the Active Services Stack
Instantly pause container operations on the production server host:
```bash
# Enter active directory
cd /app/cleancheck

# Terminate and remove container mounts
docker-compose down --volumes
```

---

## 💾 Step 2: Restore the Last Stable State (Snapshot Reversion)
Utilize the built-in disaster recovery utility script to restore the local database cache and configuration files from the last automated snapshot:
```bash
# Locate the last valid backup archive
ls -lah backups/

# Run the restoration script pointing to the archive
./scripts/restore.sh backups/cleancheck_backup_20260710_020000.tar.gz
```

---

## 🔁 Step 3: Revert Git Tag & Branch
Revert the codebase status on the repository server back to the previous stable release tag (e.g., `v0.9.5`):
```bash
# Reset local branch pointers
git checkout v0.9.5

# Re-build container images based on the previous stable code
docker-compose up -d --build
```

---

## 🔍 Step 4: Verification of Rollback Success
Once the previous version is online, immediately perform a 3-minute smoke test:
1.  Verify that users can log in successfully.
2.  Inspect database logs to confirm no new corrupt writes are being generated.
3.  Ensure the background sync queue processes remaining items safely.
