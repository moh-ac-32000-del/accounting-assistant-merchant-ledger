# Data Model

## Workspace
id, name, ownerId, createdAt, updatedAt

## Membership
workspaceId, userId, role, createdAt

## Merchant
id, workspaceId, name, phone?, notes?, defaultCurrency, status(active|archived), createdAt, updatedAt, archivedAt?

## Material
id, workspaceId, name, aliases[], defaultPrice, currency, active, createdAt, updatedAt

## Transaction
id, workspaceId, merchantId, type(purchase|payment), date, createdAt, updatedAt, currency, note, createdBy, updatedBy

Purchase:
materialId?, materialNameSnapshot, quantity, unitPrice, total

Payment:
paymentMethod, amount

## AuditEvent
id, workspaceId, merchantId, transactionId?, actorId, action(created|updated|deleted|archived|restored), summary, before?, after?, createdAt

Historical transactions keep their actual price/amount. Changing a material default price never changes history.
