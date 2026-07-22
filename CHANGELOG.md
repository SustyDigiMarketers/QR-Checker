# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-07-09

This is the initial production-ready commercial release of **CleanCheck**. It transitions the platform from a development-stage prototype into an enterprise-ready Multi-Tenant Computerized Facility Management (CFM) & Housekeeping Compliance platform.

### Added
- **Multi-Tenant Organization Structure**: Complete isolation for multiple facility companies or corporate clients.
- **Role-Based Access Control (RBAC)**: Secure access portals tailored for Super Admins, Organization Admins, and Field Housekeeping Inspectors.
- **Interactive Dashboards**: Live analytics, key performance indicators (KPIs), average rating trends, and inspection metrics.
- **Mobile-First Inspector Task Portal**: Clean task lists designed for field operations, offering zero-distraction focus.
- **Scan-to-Verify Room Inspections**: High-contrast camera barcode scanning interface for physically validating room presence.
- **Evidence Verification Layers**: Base64 photo proofs, digital touchscreen signature pad accountability, and automatic GPS geo-tracking validation.
- **Supervisor Verification Workflow**: A dual-stage operational pipeline for auditing pending reports, giving feedback, and approving or rejecting inspections.
- **Durable Local Persistence**: Fail-safe client state synchronization that tolerates networks dropping during active facility tours.
- **Google Sheets Sync Integration**: Live automated export of verified audits to target spreadsheets using Google Service Accounts.
- **Robust Security Safeguards**: Strong Firestore Security Rules (`firestore.rules`) enforcing attribute-based access control (ABAC).
- **Audit Logging System**: Logged trail tracking administrator actions, authentications, and synchronizations with IP address captures.
- **Packaging and Operations Tools**:
  - `Dockerfile` and `docker-compose.yml` for simplified microservices orchestration.
  - `install.sh` automated installer for Linux environments.
  - `backup.sh` and `restore.sh` automated snapshot and disaster recovery utilities.
  - Comprehensive `DOCUMENTATION.md` user, admin, and developer manual.

---

[1.0.0]: https://github.com/cleancheck/platform/releases/tag/v1.0.0
