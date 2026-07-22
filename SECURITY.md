# Security Policy

CleanCheck Software Solutions, LLC is dedicated to ensuring the highest level of security, data integrity, and privacy for our enterprise facility operations customers.

## Supported Versions

Only the active stable production releases are supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0.0 | :x:                |

---

## Reporting a Vulnerability

If you discover a potential security vulnerability within CleanCheck, please do **not** report it publicly through issues or social channels. Instead, follow the coordinated disclosure process:

1.  **Email**: Send a detailed security report to [security@cleancheck.com](mailto:security@cleancheck.com).
2.  **Information**: Please include:
    -   A description of the vulnerability and its potential impact.
    -   Step-by-step instructions to reproduce the issue (including scripts or payloads where possible).
    -   Your name and corporate affiliation (if applicable).
3.  **Triage**: Our security engineering team will acknowledge receipt of your report within **24 hours** and provide periodic updates as we investigate.
4.  **Resolution**: If verified, we will aim to build and deploy a patch within **7 business days** and issue a security advisory under our minor release cycle.

---

## Enterprise Hardening Best Practices

When deploying CleanCheck v1.0.0 in an enterprise environment, ensure the following constraints are adhered to:

-   **HTTPS Only**: Enforce TLS 1.3 encryption on reverse proxies (such as Nginx, Cloudflare, or Google Cloud Load Balancing) routing traffic to port `3000`.
-   **Secrets Management**: Never write production credentials, Google Sheets private keys, or API credentials into source code. Always configure them as secure runtime environment variables.
-   **Least Privilege Database Rules**: Verify that your Firestore instance actively runs the production `firestore.rules` configuration included in this package to prevent unauthorized reads and writes.
