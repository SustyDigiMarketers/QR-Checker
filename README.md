# CleanCheck – Multi-Tenant Facility Inspection & CFM Platform (v1.0.0)

CleanCheck is an enterprise-grade Computerized Facility Management (CFM) and Housekeeping Management System. It transitions facilities from simple paper checklists or single-user forms into a secure, multi-tenant, supervisor-verified operational business process. 

Inspections are tracked, audited, and verified in real-time, providing supervisors with full visibility into housekeeping compliance, room status, and inspector productivity.

---

## 🚀 Key Architectural Pillars

*   **Multi-Tenant Isolation**: Completely separate organizations, buildings, and rooms, with role-based access limits protecting tenant boundaries.
*   **Secure QR Code Verification**: QR-code-driven inspection logging requires inspectors to be physically on-site, with cryptographically regenerated scanning tokens.
*   **Comprehensive Audit Trails**: Immutable log ledger tracking all creations, updates, deletes, authentication events, and administrative overrides.
*   **Automated Backup & Self-Healing**: Automated backup routines with automatic snapshot creation, 30-day pruning, and corruption failover protection.
*   **Fully Containerized Delivery**: Multi-stage lightweight Docker image using strict non-root execution guidelines and automated docker health checks.

---

## 📦 Directory Structure

```text
├── .github/                      # GitHub Action automation workflows
│   └── workflows/
│       ├── build.yml             # Automatic build and code check pipeline
│       └── deploy.yml            # Deployment validation pipeline
├── docs/                         # Comprehensive engineering handbooks
│   ├── API.md                    # REST API end-points reference
│   ├── ARCHITECTURE.md           # Visual design, layouts, and system logic
│   ├── DATABASE.md               # Collection schemas and indices blueprint
│   ├── DEPLOYMENT.md             # VM & Bare Metal cloud setups guide
│   ├── USER_GUIDE.md             # Administrator, Manager, and Inspector instructions
│   └── DISASTER_RECOVERY.md      # Disaster Recovery, failovers, and backup SOPs
├── nginx/                        # Reverse proxy proxying configurations
│   ├── nginx.conf                # Global HTTP context and security settings
│   └── conf.d/
│       └── cleancheck.conf       # SSL, reverse proxy block, and custom domain setup
├── scripts/                      # Operational and database administration scripts
│   ├── backup.sh                 # Database snapshot execution command
│   ├── restore.sh                # Backup restoration command
│   └── install.sh                # Fresh system provisioner and setup script
├── src/                          # Front-end React applications code
│   ├── components/               # Dashboards, Inspector views, and Admin portals
│   ├── index.css                 # Tailwind utility imports and typography imports
│   ├── main.tsx                  # Single-Page App entry point
│   └── types.ts                  # Shared high-fidelity TypeScript definitions
├── server.ts                     # Single-entry full-stack Express platform
├── Dockerfile                    # Multi-stage production building instructions
├── docker-compose.yml            # Local development orchestration layout
├── docker-compose.prod.yml       # Production-grade isolated multi-container configuration
└── package.json                  # Dependencies configuration and scripts map
```

---

## 🛠️ Installation & Getting Started

### Prerequisites
*   **Node.js**: `v18.x` or higher
*   **MongoDB**: `v6.x` or higher (locally or hosted on MongoDB Atlas)
*   **Docker & Docker Compose**: (Only if deploying with containers)

### Standard Manual Local Installation
1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/cleancheck/cleancheck.git
    cd cleancheck
    ```
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Configure Environment Variables**:
    ```bash
    cp .env.example .env
    ```
    *Open `.env` and fill in your variables (e.g., `MONGODB_URI`, `JWT_SECRET`, etc.).*

4.  **Run Dev Environment**:
    ```bash
    npm run dev
    ```
    The application will bind to port `3000` (http://localhost:3000).

5.  **Build production artifacts**:
    ```bash
    npm run build
    ```

6.  **Run compiled production bundle**:
    ```bash
    npm start
    ```

---

## 🐋 Docker & Docker Compose Production Deployment

CleanCheck ships with a production-ready, fully isolated Docker compose environment located in `docker-compose.prod.yml` which deploys the app, Nginx reverse proxy with SSL, certbot, and MongoDB.

### One-Step Production Launch
```bash
# Copy and edit the environment template
cp .env.example .env

# Build and spin up the production stacks
docker compose -f docker-compose.prod.yml up -d --build
```

#### Automated Post-Boot Chain
Upon executing the compose command, the platform automatically triggers:
1.  **Dependency Bundling**: Compiles frontend code to `/dist` and backend code to `/dist/server.cjs` securely.
2.  **Service Provisioning**: Sets up isolated MongoDB databases and indexes inside `cleancheck_mongodb`.
3.  **Self-Healing**: Evaluates and automatically creates missing `/uploads`, `/backups`, and `/logs` directories.
4.  **Security Hardening**: Drops image permissions from `root` to `node` for secure isolated runtime execution.
5.  **Health Check Verification**: Launches the docker healthcheck monitor checking `http://localhost:3000/api/health`.

---

## ⚙️ Environment Variables Reference

Configure these variables inside your secure `.env` file prior to production startup:

| Variable Name | Required | Default / Example | Purpose / Description |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Yes | `production` | Switches logging, error stack traces, and caching. |
| `PORT` | Yes | `3000` | Port the internal node express container listens on. |
| `MONGODB_URI` | Yes | `mongodb://admin:pass@mongodb:27017/clean` | Database access socket URL. |
| `JWT_SECRET` | Yes | `your-high-entropy-jwt-secret-string` | Used for validating session integrity. |
| `DOMAIN_NAME` | Yes | `cleancheck.yourdomain.com` | Custom public domain name mapped via DNS. |
| `APP_URL` | Yes | `https://cleancheck.yourdomain.com` | Absolute routing endpoint url. |
| `ALLOWED_ORIGINS` | No | `*` | List of authorized CORS query origins. |
| `UPLOAD_PATH` | No | `/app/uploads` | Path on host filesystem storing image files. |
| `BACKUP_PATH` | No | `/app/backups` | Target path storing snapshot archive JSON files. |
| `LOG_PATH` | No | `/app/logs` | Target storage for audit logs and console logs. |
| `GEMINI_API_KEY`| No | `AIzaSy...` | Optional Gemini AI service token. |

---

## 🌐 Custom Domain & Reverse Proxy Setup (Nginx + SSL)

To bind CleanCheck under a custom domain (e.g. `https://cleancheck.yourdomain.com`), complete the following steps:

### 1. DNS Mapping Configuration
Point your public DNS domain provider (e.g., Cloudflare, Route53, GoDaddy) to your target VPS/Bare Metal Server's Public IPv4 Address:
*   **A Record**: Map `cleancheck.yourdomain.com` ➔ `YOUR_SERVER_IP`
*   **CNAME Record** (Optional): Map `www.cleancheck.yourdomain.com` ➔ `cleancheck.yourdomain.com`

### 2. HTTPS Let's Encrypt Certificate Provisioning
The bundled `certbot` and `nginx` containers in `docker-compose.prod.yml` coordinate automatically. To initialize certificates on your clean server:
```bash
# Execute dry run certbot request
docker compose -f docker-compose.prod.yml run --rm certbot certonly --webroot --webroot-path=/var/www/certbot --dry-run -d cleancheck.yourdomain.com

# Request live certificate
docker compose -f docker-compose.prod.yml run --rm certbot certonly --webroot --webroot-path=/var/www/certbot -d cleancheck.yourdomain.com
```
Let's Encrypt certificates renew automatically in the background every 12 hours via the secondary `certbot` container daemon.

---

## 💾 System Backups & Disaster Recovery Guide

CleanCheck incorporates a built-in backup snapshot utility that compiles entire system records.

### Running a Manual Backup
Execute the local snapshot endpoint inside the administration portal, or run:
```bash
# Trigger an immediate backup snapshot
curl -X POST http://localhost:3000/api/admin/backup -H "Authorization: Bearer <your_admin_session>"
```
Snapshots are written directly to your `BACKUP_PATH` as UTF-8 timestamped JSON archives.

### Restoring From a Snapshot
To overwrite active tables and restore a system to a verified state:
```bash
# Overwrite and sync
curl -X POST http://localhost:3000/api/admin/restore \
  -H "Authorization: Bearer <your_admin_session>" \
  -H "Content-Type: application/json" \
  -d '{"filename": "backup-2026-07-19T12-44-19.json"}'
```
All index bindings, session authentications, and data trails will be cleanly loaded without service downtime or server crashes.

---

## 🪵 Troubleshooting & Health Checks

### Check Container Status and Health Logs
```bash
# Check running container state
docker ps

# Inspect container health history
docker inspect --format='{{json .State.Health}}' cleancheck_platform

# Tail real-time service logs
docker logs -f cleancheck_platform
```

### Common Errors & Failures
*   **`MongoDB Connection Failed`**: Ensure your MongoDB credentials are correct in `.env`, and check network configurations inside Docker bridge profiles.
*   **`EACCES: permission denied, open '/app/uploads/'`**: File permissions on host directory mounts are misconfigured. Run `chmod -R 755 ./uploads` on your hosting system.

---

## 📜 License & Compliance

Distributed under the **MIT License**. See `LICENSE` for details. CleanCheck is fully compliant with modern data security legislation (GDPR/HIPAA audit logging protocols).
