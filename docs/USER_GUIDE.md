# CleanCheck User Guide & Portal Manual (v1.0.0)

This manual provides functional guides and visual blueprints for the three primary roles configured inside CleanCheck: **Super Admin**, **Organization Admin**, and **Housekeeping Inspector**.

---

## 🔑 Portal Access Credentials

For pilot testing and baseline evaluation, the database initiates with a default login profile:
*   **Username**: `admin`
*   **Default Role**: Super Admin

Administrators can register new managers or inspectors under the **Users** management pane. Registered users log in by supplying their alphanumeric usernames.

---

## 🏢 1. Super Admin Portal

The **Super Admin** acts as the global system regulator. This role possesses complete operational authority across all registered tenants (organizations).

### 1.1 Multi-Tenant Organization Enrollment
1.  Navigate to the **Organizations** tab in the sidebar navigation menu.
2.  Click **Add Organization** at the top right of the viewport.
3.  Fill out the required information in the enrollment dialog:
    *   **Organization Name**: Enter the legal company name (e.g., `"Sutter Health Network"`).
    *   **scannable Prefix Code**: Enter a short 3-6 letter uppercase code (e.g., `"SUTTER"`). This code prefixes all reporting receipts.
    *   **Contact Email / Address**: Enter administrative credentials.
4.  Click **Create Organization**. The tenant is immediately saved to Firestore and rendered in the data grid.

### 1.2 System Integration Settings
To connect reporting sheets, SMTP gateways, or customize branding:
1.  Navigate to the **Settings** tab in the main sidebar.
2.  Input your enterprise assets:
    *   **Google Sheets ID**: Insert your target reporting spreadsheet ID.
    *   **Service Email & Private Key**: Provide Google Service Account credentials.
    *   **Branding Name & Logo**: Update corporate company title and unsplash visual banner URLs.
3.  Enable **Auto-Sync** to automatically upload verified audits, or select **Logs** to manually trigger synchronization batches.

---

## 📋 2. Organization Admin (Supervisor) Portal

The **Organization Admin** manages daily facility hygiene, schedules shift workloads, and verifies inspections submitted by field staff within their specific organization scope.

### 2.1 Building Asset Mapping
To construct the physical facility tree:
1.  Navigate to the **Locations** tab.
2.  Click **Add Building** to declare a physical workspace (e.g., `"South Clinical Pavilion"`).
3.  Once created, click **Add Floor** to map elevations (e.g., `"Ground Floor"`, `"Floor 2 ICU"`).
4.  Click **Add Room** inside the floor elevations. Declare room classifications:
    *   `Restroom` (high-frequency audit schedules)
    *   `Kitchen` (hygiene checklists)
    *   `Conference` (turnover checks)
    *   `Other` (office space, clinical labs)
5.  Saving a Room automatically assigns a unique, secure 128-bit cryptographic QR Code verification token.

### 2.2 Task Scheduling & Shift Assignments
To schedule work plans:
1.  Navigate to the **Assignments** tab.
2.  Click **Create Assignment** to open the scheduling modal.
3.  Configure the daily shift schedule:
    *   **Date**: Select the scheduling calendar day.
    *   **Inspector**: Assign the target Housekeeping Inspector.
    *   **Shift**: Declare the operational period (`Morning` | `Afternoon` | `Night`).
    *   **Rooms**: Checklist and select physical rooms designated for compliance audits during this shift.
4.  Click **Assign Shift**. The task roadmap is transmitted to the Inspector's mobile portal.

### 2.3 The Verification Workflow (Approve/Reject)
1.  Navigate to the **Inspections** tab.
2.  Use the top filters to select **Supervisor Review** -> **Pending Review**.
3.  Click to expand a pending report.
4.  Review the submitted audit evidence:
    *   **Star Rating**: Star score (1-5) and cleanliness pass/fail checkbox.
    *   **Visual Proof**: Examine the captured base64 evidence photo.
    *   **Digital Signature**: Examine the touchscreen hand signature.
    *   **GPS Capture**: Verify that the GPS coordinates map exactly to the physical facility footprint.
5.  Input a Supervisor review note:
    *   To approve: Click **Approve**. The status moves to `Verified` and triggers the Sheet sync.
    *   To reject: Click **Reject**. The status updates to `Rejected`, flagging the room as dirty and requiring immediate re-cleaning.

---

## 🧹 3. Housekeeping Inspector Portal

The **Housekeeping Inspector** uses a responsive, mobile-first, zero-distraction layout designed specifically for rapid audits in physical facilities.

### 3.1 Portal Login & Daily Shifts
1.  Open the CleanCheck login interface on a mobile device or tablet.
2.  Input your Inspector username (e.g., `inspector_joe`) and click **Sign In**.
3.  The portal displays your **Daily Roadmap**—specifically showing assigned room tasks scheduled for your active shift today.

### 3.2 Executing Audits (Scan-to-Verify)
To perform an audit:
1.  Walk to the scheduled room's physical location and locate the printed **CleanCheck QR Badge**.
2.  In your mobile portal, click **Scan Room QR Code**.
3.  Align your camera with the QR Code.
4.  The platform validates the cryptographic token. Upon successful validation, the audit form slides in.
    *(Note: If the room is not scheduled or assigned to your shift, the scanner blocks access and displays an error).*

### 3.3 Completing the Inspection Form
Fill out the audit form:
1.  **Status**: Check the **Mark Cleaned** toggle if the room passed sanitation guidelines.
2.  **Cleanliness Rating**: Tap `1` to `5` stars based on physical compliance.
3.  **Corrective Remarks**: Input corrective notes (e.g., "Mopped floor, re-stocked soap dispenser").
4.  **Take Photo**: Capture an evidence photo of sanitization.
5.  **Digital Signature**: Sign your name electronically in the canvas signature block.
6.  Click **Submit Inspection**. The report is saved, a unique audit receipt reference number (e.g., `CC-20260710-594210`) is generated, and the room task is updated to "Submitted."
