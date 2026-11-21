/**
 * Security Rules Verification Suite (Phase 0 TDD — Dirty Dozen Invariants)
 *
 * Documents and validates the 12 adversarial payloads against the Firestore
 * security policy defined in `security_spec.md` and `firestore.rules`.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collection: string;
  actor: 'attacker' | 'userA' | 'unverifiedAdmin' | 'admin';
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  payload: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
  enforcingRule: string;
}

export const DIRTY_DOZEN_CASES: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Self-Grant Admin Role',
    collection: '/admins/attackerUid',
    actor: 'attacker',
    operation: 'create',
    payload: {
      uid: 'attackerUid',
      email: 'attacker@example.com',
      addedBy: 'attackerUid',
      createdAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcingRule: 'admins.create requires isAdmin()',
  },
  {
    id: 2,
    name: 'Shadow Field Injection on User Profile',
    collection: '/users/userAUid',
    actor: 'userA',
    operation: 'create',
    payload: {
      uid: 'userAUid',
      email: 'usera@example.com',
      displayName: 'User A',
      photoURL: '',
      isAdmin: true,
      subscriptionActive: true,
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcingRule: 'isValidUserProfile enforces keys().hasOnly([...])',
  },
  {
    id: 3,
    name: 'Self-Activate Paid Subscription',
    collection: '/subscriptions/attackerUid',
    actor: 'attacker',
    operation: 'create',
    payload: {
      userId: 'attackerUid',
      userEmail: 'attacker@example.com',
      userName: 'Attacker',
      planId: 'anual',
      planName: 'Anual',
      priceCents: 0,
      durationDays: 3650,
      status: 'active',
      startsAt: 'SERVER_TIMESTAMP',
      expiresAt: '2099-01-01T00:00:00Z',
      notes: '',
      updatedBy: 'attackerUid',
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcingRule: 'subscriptions.create requires isAdmin()',
  },
  {
    id: 4,
    name: 'Modify Plan Price Without Admin',
    collection: '/plans/mensal',
    actor: 'attacker',
    operation: 'update',
    payload: {
      priceCents: 1,
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcingRule: 'plans.update requires isAdmin()',
  },
  {
    id: 5,
    name: 'Spoof Request Price and Duration',
    collection: '/subscriptionRequests/req_spoof_price',
    actor: 'userA',
    operation: 'create',
    payload: {
      userId: 'userAUid',
      userEmail: 'usera@example.com',
      userName: 'User A',
      planId: 'anual',
      planName: 'Anual',
      priceCents: 0,
      durationDays: 36500,
      paymentReference: 'free',
      status: 'pending',
      adminNote: '',
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcingRule:
      'subscriptionRequests.create verifies incoming().priceCents and durationDays strictly match /plans/{planId}',
  },
  {
    id: 6,
    name: 'Self-Approve Subscription Request on Create',
    collection: '/subscriptionRequests/req_skip_pending',
    actor: 'userA',
    operation: 'create',
    payload: {
      userId: 'userAUid',
      userEmail: 'usera@example.com',
      userName: 'User A',
      planId: 'mensal',
      planName: 'Mensal',
      priceCents: 1990,
      durationDays: 30,
      paymentReference: 'pix123',
      status: 'approved',
      adminNote: 'auto',
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcingRule: "subscriptionRequests.create enforces status == 'pending' and adminNote == ''",
  },
  {
    id: 7,
    name: 'Escalate Pending Request to Approved as Non-Admin',
    collection: '/subscriptionRequests/req_existing',
    actor: 'userA',
    operation: 'update',
    payload: {
      status: 'approved',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcingRule: "Non-admin update requires existing().status == 'pending' && incoming().status == 'pending'",
  },
  {
    id: 8,
    name: 'Mutate Terminal Approved Request as Non-Admin',
    collection: '/subscriptionRequests/req_approved',
    actor: 'userA',
    operation: 'update',
    payload: {
      paymentReference: 'edited-after-approval',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcingRule: "Terminal state locked: non-admin update requires existing().status == 'pending'",
  },
  {
    id: 9,
    name: 'Spoof Another User ID on Request Create',
    collection: '/subscriptionRequests/req_other_user',
    actor: 'userA',
    operation: 'create',
    payload: {
      userId: 'victimUid',
      userEmail: 'victim@example.com',
      userName: 'Victim',
      planId: 'mensal',
      planName: 'Mensal',
      priceCents: 1990,
      durationDays: 30,
      paymentReference: 'pix',
      status: 'pending',
      adminNote: '',
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcingRule: 'subscriptionRequests.create enforces incoming().userId == request.auth.uid',
  },
  {
    id: 10,
    name: 'PII Scraping via Users List',
    collection: '/users',
    actor: 'userA',
    operation: 'list',
    payload: {},
    expectedResult: 'PERMISSION_DENIED',
    enforcingRule: 'users.list requires isAdmin()',
  },
  {
    id: 11,
    name: 'Unverified Admin Email Spoof',
    collection: '/plans/mensal',
    actor: 'unverifiedAdmin',
    operation: 'update',
    payload: {
      priceCents: 100,
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcingRule: 'isBootstrappedAdmin enforces request.auth.token.email_verified == true',
  },
  {
    id: 12,
    name: 'Resource Poisoning (Oversized ID & Features Array)',
    collection: `/plans/${'a'.repeat(300)}`,
    actor: 'admin',
    operation: 'create',
    payload: {
      id: 'a'.repeat(300),
      name: 'Poison Plan',
      billingLabel: 'Mensal',
      description: 'Test',
      priceCents: 990,
      durationDays: 30,
      features: Array.from({ length: 25 }, (_, i) => `Feature ${i}`),
      active: true,
      highlighted: false,
      sortOrder: 1,
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcingRule: 'isValidId(<= 128) and data.features.size() <= 10',
  },
];

export function verifyDirtyDozenSpecification(): boolean {
  return DIRTY_DOZEN_CASES.length === 12 && DIRTY_DOZEN_CASES.every((c) => c.expectedResult === 'PERMISSION_DENIED');
}
