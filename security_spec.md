# Security Specification — SESI-PE 2027 Access Control

## 1. Data Invariants
1. **Default Deny**: All paths not explicitly matched (`/accessRequests/{userId}` and `/admins/{userId}`) are strictly denied (`allow read, write: if false`).
2. **Verified Identity**: Every authenticated read/write requires `request.auth != null` and `request.auth.token.email_verified == true`.
3. **PII Isolation**: Because `/accessRequests/{userId}` stores `email`, `displayName`, and `photoURL`, `get` is strictly restricted to the document owner (`request.auth.uid == userId`) or a verified administrator (`isAdmin()`). `list` on `/accessRequests` is restricted strictly to `isAdmin() || (isSignedIn() && resource.data.uid == request.auth.uid)`.
4. **Prevent Self-Approval / Privilege Escalation**: A non-admin user creating their own `/accessRequests/{userId}` document MUST set `uid == request.auth.uid`, `status == 'pending'`, and `role == 'viewer'`, with `createdAt == request.time` and `updatedAt == request.time`. Only `isAdmin()` can transition `status` to `'approved'` or `'rejected'`, or change `role`.
5. **Immutable Fields**: `uid` and `createdAt` cannot be modified during updates (`incoming().uid == existing().uid && incoming().createdAt == existing().createdAt`).

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Create**: `auth = null`, creating `/accessRequests/user1`.
2. **Unverified Email Spoof**: `auth = { uid: 'u1', email: 'maykon.euro@hotmail.com', email_verified: false }` attempting admin read/write.
3. **Identity Spoofing on Create**: User `u1` creating `/accessRequests/u2` with `uid: 'u2'`.
4. **Self-Approval on Create**: Non-admin user `u1` creating `/accessRequests/u1` with `status: 'approved'`.
5. **Self-Admin Promotion on Create**: Non-admin user `u1` creating `/accessRequests/u1` with `role: 'admin'`.
6. **Shadow Field Injection on Create**: Adding `{ isSuperAdmin: true }` to `/accessRequests/u1`.
7. **PII Leak via Cross-User Get**: Authenticated user `u2` attempting `get(/accessRequests/u1)`.
8. **Unauthorized Status Update by Regular User**: User `u1` attempting `update(/accessRequests/u1, { status: 'approved' })`.
9. **Immutable Field Mutation**: Admin or user attempting to change `uid` or `createdAt` on `/accessRequests/u1`.
10. **Forged Client Timestamp**: Creating `/accessRequests/u1` with a past/future timestamp (`createdAt != request.time`).
11. **Oversized String DoW Attack**: Creating `/accessRequests/u1` with `displayName` > 120 chars or `photoURL` > 500 chars.
12. **Unauthorized Admin Collection Write**: Non-admin user `u1` attempting to create `/admins/u1`.
