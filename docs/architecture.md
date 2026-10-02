# Architecture

Firebase Authentication identifies users. Firestore is the financial source of truth. Google Sheets is an authenticated export/share integration, not the primary database.

Use stable IDs from day one: userId, workspaceId, merchantId, materialId, transactionId, auditEventId.

Flow:
Google Sign-In -> Firebase Auth -> Workspace -> Merchants -> Transactions

Transactions:
- purchase: increases amount owed
- payment: decreases amount owed
- credit: payments exceed purchases

Security:
- No Firebase Admin credentials in the browser.
- Firestore rules enforce workspace membership.
- Financial writes are authenticated and validated.
- Edits/deletes create audit events.
- Exports use authenticated workspace access.

The model is intentionally workspace-oriented for future integration into Accounting Assistant.
