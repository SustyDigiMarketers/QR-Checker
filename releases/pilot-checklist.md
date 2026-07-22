# Pilot Team Handover Checklist (v1.0.0)

This document contains the step-by-step verification protocols that the customer pilot team should perform on-site to sign off on the baseline deployment.

---

## 👥 Phase 1: Accounts & RBAC Verification
*   [ ] **Login Verification**: Log in using the designated `Super Admin` username and verify immediate landing on the Analytics dashboard.
*   [ ] **User Creation**: Navigate to the **Users** menu, register a test `Organization Admin` user, and a test `Inspector` user.
*   [ ] **Access Isolation**: Log in as the `Inspector` user in a separate incognito window. Verify that the Admin sidebar menus are completely hidden and that they are redirected directly to the shift roadmap.

---

## 🏢 Phase 2: Facility Mapping & Token Generation
*   [ ] **Add Organization**: Create the pilot test organization (e.g., "General Hospital Corp").
*   [ ] **Add Infrastructure**: Navigate to **Locations**, register a physical building, add a test floor elevation, and register 3 inspectable rooms.
*   [ ] **QR Printing**: Select the newly registered rooms, click **Print QR Badge**, and download or open the printed badges PDF.

---

## 🧹 Phase 3: Shift Scheduling & Inspection Submission
*   [ ] **Task Scheduling**: As the Admin, navigate to **Assignments**, select the test inspector, choose the active day, check the registered rooms, and click **Assign Shift**.
*   [ ] **Inspection Run**: On a mobile phone, log in as the `Inspector` user. Go to the active task list, scan a room's printed QR code, fill out the rating/checklist form, sign electronically, and click **Submit**.
*   [ ] **Check Receipt**: Confirm that a unique receipt reference number is returned instantly.

---

## 🔍 Phase 4: Supervisor Validation & Spreadsheet Sync
*   [ ] **Supervisor Review**: Log back in as the Admin/Supervisor. Go to the **Inspections** pane, locate the submitted report, review the GPS coordinates and signature, and click **Approve / Verify**.
*   [ ] **Spreadsheet Export**: Open the connected Google Sheet and confirm that the verified inspection details automatically populated a new row with precise formatting.
