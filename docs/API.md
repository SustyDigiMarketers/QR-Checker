# CleanCheck API Reference Manual (v1.0.0)

This document provides a comprehensive technical reference for the CleanCheck Express Node.js backend REST API.

---

## 🔒 Global Security & Authentication

All API endpoints are prefixed with `/api`.
*   **Authentication**: Handled via username session lookup. Administrative queries require passing a valid administrator `userId` inside the query parameters or request body payload for session/role verification.
*   **Authorization Policy (ABAC)**: Requesting operations check the matching User role from `in-memory cache` before executing mutations. `Super Admin` and `Organization Admin` possess complete multi-tenant read-write capabilities. `Inspector` role is restricted to reading shift assignments and submitting inspections.

---

## 🚦 Endpoints Directory

### 1. Authentication
*   `POST /api/auth/login` - Authenticate user session
*   `POST /api/auth/logout` - Invalidate active session

### 2. User Management (Admin Only)
*   `GET /api/users` - Retrieve all users (scoped)
*   `POST /api/users` - Register a new user
*   `PUT /api/users/:id` - Update an existing user
*   `DELETE /api/users/:id` - Delete a user

### 3. Tenant Organizations (Super Admin Only)
*   `GET /api/organizations` - Retrieve list of active tenants
*   `POST /api/organizations` - Register a new tenant organization

### 4. Locations & Physical Assets (Admin Only)
*   `GET /api/buildings` - List physical buildings
*   `POST /api/buildings` - Register a new building
*   `GET /api/rooms` - List inspectable rooms
*   `POST /api/rooms` - Register a new room & generate scannable token
*   `GET /api/rooms/scan` - QR presence scan-to-verify verification endpoint

### 5. Task Scheduling
*   `GET /api/assignments` - List task assignments
*   `POST /api/assignments` - Register a new task assignment (Admin Only)
*   `DELETE /api/assignments/:id` - Remove task assignment (Admin Only)

### 6. Inspections & Audits
*   `GET /api/inspections` - Retrieve inspection logs
*   `POST /api/inspections` - Submit an active room inspection report (Inspector/Admin)
*   `DELETE /api/inspections/:id` - Delete an inspection report (Admin Only)
*   `POST /api/inspections/:id/verify` - Supervisor verification decision (Admin Only)

### 7. Synchronization & Settings
*   `GET /api/settings` - Retrieve global settings (Admin Only)
*   `POST /api/settings` - Save global settings (Admin Only)
*   `POST /api/sync/sheets` - Manual sync of pending audits to Google Sheets (Admin Only)
*   `POST /api/sync/retry` - Manual retry and queue flushing of pending Firestore writes (Admin Only)
*   `GET /api/audit-logs` - Retrieve system security logs (Admin Only)

---

## 📦 API Payloads & Contract Specification

### `POST /api/auth/login`
Validates user credentials and initiates the session, adding a login audit log.

**Request Payload:**
```json
{
  "username": "admin"
}
```

**Success Response (200 OK):**
```json
{
  "user": {
    "id": "usr-1",
    "username": "admin",
    "email": "admin@example.com",
    "role": "Super Admin",
    "fullName": "Admin User",
    "active": true,
    "avatarUrl": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop"
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "error": "User not found or is currently deactivated"
}
```

---

### `POST /api/inspections`
Enables field inspectors to submit an inspectable room report. Includes duplicate submission block within a 60-second window to prevent race conditions.

**Request Payload:**
```json
{
  "roomId": "rm-1",
  "inspectorId": "usr-3",
  "cleaned": true,
  "rating": 5,
  "remarks": "Polished mirrors, wiped countertops, fully re-stocked paper towel rolls.",
  "deviceTime": "2026-07-10T11:45:00.000Z",
  "photoUrl": "data:image/jpeg;base64,...",
  "signatureUrl": "data:image/png;base64,...",
  "latitude": 37.774929,
  "longitude": -122.419416
}
```

**Success Response (200 OK):**
```json
{
  "id": "ins-1783689123456",
  "roomId": "rm-1",
  "roomName": "Executive Restroom A",
  "floorName": "Ground Floor",
  "buildingName": "HQ West Tower",
  "organizationName": "Apex Corporates",
  "inspectorId": "usr-3",
  "inspectorName": "Joe Miller",
  "cleaned": true,
  "rating": 5,
  "remarks": "Polished mirrors, wiped countertops, fully re-stocked paper towel rolls.",
  "deviceTime": "2026-07-10T11:45:00.000Z",
  "photoUrl": "data:image/jpeg;base64,...",
  "signatureUrl": "data:image/png;base64,...",
  "latitude": 37.774929,
  "longitude": -122.419416,
  "syncedToGoogleSheets": false,
  "createdAt": "2026-07-10T11:45:02.123Z",
  "shift": "Morning",
  "status": "Submitted",
  "receiptNumber": "CC-20260710-859421"
}
```

**Cooldown Block Response (429 Too Many Requests):**
```json
{
  "error": "Duplicate submission blocked. An audit for this room was already logged 15 seconds ago. Please wait 45 seconds or reset."
}
```

---

### `POST /api/inspections/:id/verify`
Administrators and Supervisors utilize this endpoint to verify or reject a submitted inspection report. Setting status to `Verified` marks the document eligible for synchronization to the Google Sheet reporting layer.

**Request Payload:**
```json
{
  "status": "Verified",
  "supervisorRemarks": "Excellent compliance. Hand signature and GPS coordinates match physical checkpoint.",
  "operatorUserId": "usr-1"
}
```

**Success Response (200 OK):**
```json
{
  "id": "ins-1783689123456",
  "roomId": "rm-1",
  "roomName": "Executive Restroom A",
  "status": "Verified",
  "supervisorRemarks": "Excellent compliance. Hand signature and GPS coordinates match physical checkpoint.",
  "verifiedAt": "2026-07-10T12:05:10.452Z"
}
```

---

### `GET /api/rooms/scan`
Validates that the physical camera presence scan conforms to the room's registered cryptographic QR token before allowing form access. If the user is an inspector, validates that they are actively scheduled for that room during their current shift.

**Query Parameters:**
*   `token` (string, required) - Secure token extracted from the physical barcode.
*   `inspectorId` (string, optional) - Inspector user ID for scheduled shift validation.

**Success Response (200 OK):**
```json
{
  "room": {
    "id": "rm-1",
    "floorId": "flr-1",
    "buildingId": "bld-1",
    "name": "Executive Restroom A",
    "type": "Restroom",
    "qrToken": "qr-exec-restroom-a"
  },
  "floorName": "Ground Floor",
  "buildingName": "HQ West Tower",
  "organizationName": "Apex Corporates"
}
```

**Unscheduled Shift Block (403 Forbidden):**
```json
{
  "error": "❌ This room is not assigned to you. Please contact your supervisor."
}
```

---

## ⚠️ Error Handling Standard

When queries encounter failures (validation errors, unauthorized writes, database connection timeouts), the server guarantees a standard, structured JSON response format:

```json
{
  "error": "The detailed functional error message explaining the failure or block condition."
}
```

In the event of database authorization restrictions, Firestore returns detailed ABAC debug logs to the Node server console, while masking internal database path variables from the public-facing HTTP API client.
