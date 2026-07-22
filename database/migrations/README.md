# Database Migrations Directory (v1.0.0)

This folder is designated for managing future structured schema migrations of the CleanCheck database layer.

---

## 🏛️ Schema Version Control Strategy

While the initial production pilot (**v1.0.0**) relies on Google Cloud Firestore as the document system of record and a flat `in-memory cache` local cache file, future structural upgrades (such as migrating to relational databases or altering collection definitions) must follow this lifecycle:

1.  **Script Isolation**: Place any data transformation, collection cleaning, or field addition Node/Python script under `/database/migrations/v1.1.x/`.
2.  **Dry Runs**: Execute migrations in a isolated GCP staging project before executing on production documents.
3.  **Idempotence**: Scripts must be designed to be re-run safely if an error interrupts execution mid-migration (using Firestore transactions or batched writes).

---

## 🚀 Execution Guide

To execute a migration script against an active environment:
```bash
# Set credentials
export GOOGLE_APPLICATION_CREDENTIALS="service-account-key.json"
export FIRESTORE_DATABASE_ID="(default)"

# Execute transition scripts
node database/migrations/v1.1.0/add-organization-billing-tier.js
```
