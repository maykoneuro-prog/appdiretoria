/**
 * Firestore Security Rules Test Specification (Dirty Dozen Verification)
 * Verifies that all 12 adversarial payloads are rejected with PERMISSION_DENIED.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  auth: { uid: string; email: string; email_verified: boolean } | null;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Create',
    auth: null,
    operation: 'create',
    path: '/accessRequests/user_1',
    payload: {
      uid: 'user_1',
      email: 'user1@example.com',
      displayName: 'User One',
      photoURL: '',
      status: 'pending',
      role: 'viewer',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Spoof of Admin',
    auth: { uid: 'spoof_1', email: 'maykon.euro@hotmail.com', email_verified: false },
    operation: 'get',
    path: '/accessRequests/other_user',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Identity Spoofing on Create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    operation: 'create',
    path: '/accessRequests/user_2',
    payload: {
      uid: 'user_2',
      email: 'user2@example.com',
      displayName: 'User Two',
      photoURL: '',
      status: 'pending',
      role: 'viewer',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Self-Approval on Create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    operation: 'create',
    path: '/accessRequests/user_1',
    payload: {
      uid: 'user_1',
      email: 'user1@example.com',
      displayName: 'User One',
      photoURL: '',
      status: 'approved',
      role: 'viewer',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Self-Admin Promotion on Create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    operation: 'create',
    path: '/accessRequests/user_1',
    payload: {
      uid: 'user_1',
      email: 'user1@example.com',
      displayName: 'User One',
      photoURL: '',
      status: 'pending',
      role: 'admin',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Shadow Field Injection on Create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    operation: 'create',
    path: '/accessRequests/user_1',
    payload: {
      uid: 'user_1',
      email: 'user1@example.com',
      displayName: 'User One',
      photoURL: '',
      status: 'pending',
      role: 'viewer',
      isSuperAdmin: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'PII Leak via Cross-User Get',
    auth: { uid: 'user_2', email: 'user2@example.com', email_verified: true },
    operation: 'get',
    path: '/accessRequests/user_1',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Unauthorized Status Update by Regular User',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    operation: 'update',
    path: '/accessRequests/user_1',
    payload: {
      status: 'approved',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Immutable Field Mutation (uid)',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    operation: 'update',
    path: '/accessRequests/user_1',
    payload: {
      uid: 'hacked_uid',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Forged Client Timestamp',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    operation: 'create',
    path: '/accessRequests/user_1',
    payload: {
      uid: 'user_1',
      email: 'user1@example.com',
      displayName: 'User One',
      photoURL: '',
      status: 'pending',
      role: 'viewer',
      createdAt: '1999-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Oversized String DoW Attack',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    operation: 'create',
    path: '/accessRequests/user_1',
    payload: {
      uid: 'user_1',
      email: 'user1@example.com',
      displayName: 'A'.repeat(500),
      photoURL: '',
      status: 'pending',
      role: 'viewer',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unauthorized Admin Collection Write',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    operation: 'create',
    path: '/admins/user_1',
    payload: {
      uid: 'user_1',
      email: 'user1@example.com',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
];
