import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  OperationType,
  OWNER_ADMIN_EMAIL,
} from '../firebase';
import type {
  AdminUser,
  BillingSettings,
  SubscriptionPlan,
  SubscriptionRequest,
  SubscriptionStatus,
  UserProfile,
  UserSubscription,
} from '../types/subscription';

export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  paywallEnabled: true,
  pixKey: '',
  paymentLink: '',
  paymentInstructions:
    'Escolha um plano abaixo, realize o pagamento via Pix ou link informado e envie o código/comprovante na solicitação para liberação imediata.',
  supportContact: OWNER_ADMIN_EMAIL,
  creatorPhotoUrl: '',
  updatedAt: null,
};

export interface PlanDraftInput {
  id?: string;
  name: string;
  billingLabel: string;
  description: string;
  priceCents: number;
  durationDays: number;
  features: string[];
  active: boolean;
  highlighted: boolean;
  sortOrder: number;
}

export const DEFAULT_PLANS_SEED: PlanDraftInput[] = [
  {
    id: 'mensal',
    name: 'Acesso Mensal',
    billingLabel: 'Mensal',
    description: 'Acesso completo a todas as ferramentas de mod, patches e auto-organizador por 30 dias.',
    priceCents: 1990,
    durationDays: 30,
    features: [
      'Auto-Organizador de pastas e geração .ZIP pronto para Xbox 360',
      'Editor Hex PowerPC Big-Endian e Patch Binário IPS',
      'Pacotes de Carros, Armas, Futebol e DashLaunch INI',
    ],
    active: true,
    highlighted: false,
    sortOrder: 1,
  },
  {
    id: 'trimestral',
    name: 'Acesso Trimestral',
    billingLabel: 'Trimestral',
    description: 'Economize assinando 90 dias contínuos de estúdio completo para seus projetos.',
    priceCents: 4990,
    durationDays: 90,
    features: [
      'Tudo do plano Mensal por 90 dias corridos',
      'Exportação e backup ilimitado de projetos .x360project.json',
      'Preparador de texturas 512x512 e ícones FSD/Aurora',
    ],
    active: true,
    highlighted: false,
    sortOrder: 2,
  },
  {
    id: 'anual',
    name: 'Acesso Anual Pro',
    billingLabel: 'Anual',
    description: 'Melhor custo-benefício com 365 dias de acesso total para criadores de patches.',
    priceCents: 14990,
    durationDays: 365,
    features: [
      'Acesso completo durante 365 dias sem interrupções',
      'Todas as ferramentas de edição binária, IPS, Hex e Mods',
      'Manual completo e atualizações do estúdio incluídas',
    ],
    active: true,
    highlighted: true,
    sortOrder: 3,
  },
];

export function formatPriceBrl(priceCents: number): string {
  const value = Math.max(0, priceCents) / 100;
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatDurationLabel(days: number): string {
  if (days === 1) return '1 dia';
  if (days === 7) return '7 dias (Semanal)';
  if (days === 15) return '15 dias (Quinzenal)';
  if (days === 30) return '30 dias (Mensal)';
  if (days === 90) return '90 dias (Trimestral)';
  if (days === 180) return '180 dias (Semestral)';
  if (days === 365) return '365 dias (Anual)';
  return `${days} dias`;
}

export function sanitizeSlugId(raw: string): string {
  const cleaned = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return cleaned || `plano-${Date.now()}`;
}

export function isSubscriptionCurrentlyActive(sub: UserSubscription | null): boolean {
  if (!sub || sub.status !== 'active' || !sub.expiresAt) return false;
  return sub.expiresAt.toMillis() > Date.now();
}

export function getRemainingDays(expiresAt: Timestamp | null): number {
  if (!expiresAt) return 0;
  const diffMs = expiresAt.toMillis() - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function isBootstrappedOwner(user: User | null): boolean {
  return Boolean(
    user &&
      user.emailVerified &&
      user.email?.toLowerCase() === OWNER_ADMIN_EMAIL.toLowerCase()
  );
}

// =========================================================
// Subscriptions (onSnapshot listeners)
// =========================================================

export function subscribePlans(
  onData: (plans: SubscriptionPlan[]) => void
): () => void {
  const q = query(collection(db, 'plans'), orderBy('sortOrder', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const items: SubscriptionPlan[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id ?? d.id),
          name: String(data.name ?? ''),
          billingLabel: String(data.billingLabel ?? ''),
          description: String(data.description ?? ''),
          priceCents: Number(data.priceCents ?? 0),
          durationDays: Number(data.durationDays ?? 30),
          features: Array.isArray(data.features) ? data.features.map(String) : [],
          active: Boolean(data.active),
          highlighted: Boolean(data.highlighted),
          sortOrder: Number(data.sortOrder ?? 0),
          createdAt: (data.createdAt as Timestamp) ?? null,
          updatedAt: (data.updatedAt as Timestamp) ?? null,
        };
      });
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'plans');
    }
  );
}

export function subscribeBillingSettings(
  onData: (settings: BillingSettings, existsInDb: boolean) => void
): () => void {
  const ref = doc(db, 'siteSettings', 'billing');
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(DEFAULT_BILLING_SETTINGS, false);
        return;
      }
      const data = snap.data();
      onData(
        {
          paywallEnabled: Boolean(data.paywallEnabled),
          pixKey: String(data.pixKey ?? ''),
          paymentLink: String(data.paymentLink ?? ''),
          paymentInstructions: String(data.paymentInstructions ?? ''),
          supportContact: String(data.supportContact ?? ''),
          creatorPhotoUrl: String(data.creatorPhotoUrl ?? ''),
          updatedAt: (data.updatedAt as Timestamp) ?? null,
        },
        true
      );
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'siteSettings/billing');
    }
  );
}

export function subscribeMySubscription(
  uid: string,
  onData: (sub: UserSubscription | null) => void
): () => void {
  const path = `subscriptions/${uid}`;
  return onSnapshot(
    doc(db, 'subscriptions', uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data();
      onData({
        userId: String(d.userId ?? uid),
        userEmail: String(d.userEmail ?? ''),
        userName: String(d.userName ?? ''),
        planId: String(d.planId ?? ''),
        planName: String(d.planName ?? ''),
        priceCents: Number(d.priceCents ?? 0),
        durationDays: Number(d.durationDays ?? 30),
        status: (d.status as SubscriptionStatus) ?? 'expired',
        startsAt: (d.startsAt as Timestamp) ?? null,
        expiresAt: (d.expiresAt as Timestamp) ?? null,
        notes: String(d.notes ?? ''),
        updatedBy: String(d.updatedBy ?? ''),
        createdAt: (d.createdAt as Timestamp) ?? null,
        updatedAt: (d.updatedAt as Timestamp) ?? null,
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeMyRequests(
  uid: string,
  onData: (requests: SubscriptionRequest[]) => void
): () => void {
  const q = query(
    collection(db, 'subscriptionRequests'),
    where('userId', '==', uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => mapRequestDoc(d.id, d.data()))
        .sort(
          (a, b) =>
            (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)
        );
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'subscriptionRequests');
    }
  );
}

export function subscribeAdminStatus(
  user: User,
  onData: (isAdmin: boolean) => void
): () => void {
  if (isBootstrappedOwner(user)) {
    onData(true);
    return () => {};
  }
  const path = `admins/${user.uid}`;
  return onSnapshot(
    doc(db, 'admins', user.uid),
    (snap) => {
      onData(snap.exists() && user.emailVerified);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeAllSubscriptions(
  onData: (subs: UserSubscription[]) => void
): () => void {
  const q = query(collection(db, 'subscriptions'), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const items: UserSubscription[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          userId: String(d.userId ?? docSnap.id),
          userEmail: String(d.userEmail ?? ''),
          userName: String(d.userName ?? ''),
          planId: String(d.planId ?? ''),
          planName: String(d.planName ?? ''),
          priceCents: Number(d.priceCents ?? 0),
          durationDays: Number(d.durationDays ?? 30),
          status: (d.status as SubscriptionStatus) ?? 'expired',
          startsAt: (d.startsAt as Timestamp) ?? null,
          expiresAt: (d.expiresAt as Timestamp) ?? null,
          notes: String(d.notes ?? ''),
          updatedBy: String(d.updatedBy ?? ''),
          createdAt: (d.createdAt as Timestamp) ?? null,
          updatedAt: (d.updatedAt as Timestamp) ?? null,
        };
      });
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'subscriptions');
    }
  );
}

export function subscribeAllRequests(
  onData: (requests: SubscriptionRequest[]) => void
): () => void {
  const q = query(
    collection(db, 'subscriptionRequests'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => mapRequestDoc(d.id, d.data())));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'subscriptionRequests');
    }
  );
}

export function subscribeAllUsers(
  onData: (users: UserProfile[]) => void
): () => void {
  const q = query(collection(db, 'users'), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const items: UserProfile[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          uid: String(d.uid ?? docSnap.id),
          email: String(d.email ?? ''),
          displayName: String(d.displayName ?? ''),
          photoURL: String(d.photoURL ?? ''),
          createdAt: (d.createdAt as Timestamp) ?? null,
          updatedAt: (d.updatedAt as Timestamp) ?? null,
        };
      });
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    }
  );
}

export function subscribeAdminsList(
  onData: (admins: AdminUser[]) => void
): () => void {
  const q = query(collection(db, 'admins'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const items: AdminUser[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          uid: String(d.uid ?? docSnap.id),
          email: String(d.email ?? ''),
          addedBy: String(d.addedBy ?? ''),
          createdAt: (d.createdAt as Timestamp) ?? null,
        };
      });
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'admins');
    }
  );
}

function mapRequestDoc(id: string, d: Record<string, unknown>): SubscriptionRequest {
  return {
    id,
    userId: String(d.userId ?? ''),
    userEmail: String(d.userEmail ?? ''),
    userName: String(d.userName ?? ''),
    planId: String(d.planId ?? ''),
    planName: String(d.planName ?? ''),
    priceCents: Number(d.priceCents ?? 0),
    durationDays: Number(d.durationDays ?? 30),
    paymentReference: String(d.paymentReference ?? ''),
    status: (d.status as SubscriptionRequest['status']) ?? 'pending',
    adminNote: String(d.adminNote ?? ''),
    createdAt: (d.createdAt as Timestamp) ?? null,
    updatedAt: (d.updatedAt as Timestamp) ?? null,
  };
}

// =========================================================
// Mutations
// =========================================================

export async function upsertUserProfile(user: User): Promise<void> {
  if (!user.email || !user.emailVerified) return;
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const displayName = (user.displayName || user.email.split('@')[0] || 'Usuário').slice(0, 120);
  const photoURL = (user.photoURL || '').slice(0, 500);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email: user.email.slice(0, 160),
        displayName,
        photoURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName,
        photoURL,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function seedInitialAdminDefaultsIfEmpty(): Promise<boolean> {
  try {
    const plansSnap = await getDocs(collection(db, 'plans'));
    let seeded = false;

    if (plansSnap.empty) {
      for (const plan of DEFAULT_PLANS_SEED) {
        await savePlan(plan, true);
      }
      seeded = true;
    }

    const billingRef = doc(db, 'siteSettings', 'billing');
    const billingSnap = await getDoc(billingRef);
    if (!billingSnap.exists()) {
      await saveBillingSettings(DEFAULT_BILLING_SETTINGS);
      seeded = true;
    }

    return seeded;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'plans');
  }
}

export async function savePlan(
  input: PlanDraftInput,
  isNew: boolean
): Promise<string> {
  const planId = isNew
    ? sanitizeSlugId(input.id || input.name)
    : sanitizeSlugId(input.id || '');
  const path = `plans/${planId}`;
  const ref = doc(db, 'plans', planId);

  const normalizedFeatures = input.features
    .map((f) => f.trim().slice(0, 120))
    .filter((f) => f.length > 0)
    .slice(0, 10);

  const payload = {
    name: input.name.trim().slice(0, 80) || 'Plano',
    billingLabel: input.billingLabel.trim().slice(0, 40) || 'Personalizado',
    description: input.description.trim().slice(0, 300),
    priceCents: Math.max(0, Math.min(10000000, Math.round(input.priceCents))),
    durationDays: Math.max(1, Math.min(36500, Math.round(input.durationDays))),
    features: normalizedFeatures,
    active: Boolean(input.active),
    highlighted: Boolean(input.highlighted),
    sortOrder: Math.max(0, Math.min(1000, Math.round(input.sortOrder))),
    updatedAt: serverTimestamp(),
  };

  try {
    if (isNew) {
      await setDoc(ref, {
        id: planId,
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, payload);
    }
    return planId;
  } catch (error) {
    handleFirestoreError(
      error,
      isNew ? OperationType.CREATE : OperationType.UPDATE,
      path
    );
  }
}

export async function deletePlanById(planId: string): Promise<void> {
  const path = `plans/${planId}`;
  try {
    await deleteDoc(doc(db, 'plans', planId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveBillingSettings(
  settings: Omit<BillingSettings, 'updatedAt'>
): Promise<void> {
  const path = 'siteSettings/billing';
  const ref = doc(db, 'siteSettings', 'billing');
  const payload = {
    paywallEnabled: Boolean(settings.paywallEnabled),
    pixKey: settings.pixKey.trim().slice(0, 180),
    paymentLink: settings.paymentLink.trim().slice(0, 300),
    paymentInstructions: settings.paymentInstructions.trim().slice(0, 800),
    supportContact: settings.supportContact.trim().slice(0, 180),
    creatorPhotoUrl: (settings.creatorPhotoUrl ?? '').trim().slice(0, 500),
    updatedAt: serverTimestamp(),
  };

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, payload);
    } else {
      await updateDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveCreatorPhotoSetting(
  currentSettings: BillingSettings,
  creatorPhotoUrl: string
): Promise<void> {
  await saveBillingSettings({
    paywallEnabled: currentSettings.paywallEnabled,
    pixKey: currentSettings.pixKey,
    paymentLink: currentSettings.paymentLink,
    paymentInstructions: currentSettings.paymentInstructions,
    supportContact: currentSettings.supportContact,
    creatorPhotoUrl,
  });
}

export async function createSubscriptionRequest(
  user: User,
  plan: SubscriptionPlan,
  paymentReference: string
): Promise<string> {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `subscriptionRequests/${requestId}`;
  const userName = (
    user.displayName ||
    user.email?.split('@')[0] ||
    'Assinante'
  ).slice(0, 120);

  try {
    await setDoc(doc(db, 'subscriptionRequests', requestId), {
      userId: user.uid,
      userEmail: (user.email ?? '').slice(0, 160),
      userName,
      planId: plan.id,
      planName: plan.name.slice(0, 80),
      priceCents: Math.round(plan.priceCents),
      durationDays: Math.round(plan.durationDays),
      paymentReference: paymentReference.trim().slice(0, 200),
      status: 'pending',
      adminNote: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return requestId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function cancelPendingRequest(requestId: string): Promise<void> {
  const path = `subscriptionRequests/${requestId}`;
  try {
    await deleteDoc(doc(db, 'subscriptionRequests', requestId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function approveRequestAndActivate(
  req: SubscriptionRequest,
  adminUid: string,
  adminNote: string,
  overrideDurationDays?: number
): Promise<void> {
  const daysToGrant = Math.max(
    1,
    Math.min(36500, Math.round(overrideDurationDays ?? req.durationDays))
  );
  const subPath = `subscriptions/${req.userId}`;
  const reqPath = `subscriptionRequests/${req.id}`;

  try {
    const subRef = doc(db, 'subscriptions', req.userId);
    const existingSubSnap = await getDoc(subRef);

    const nowMs = Date.now();
    let baseStartMs = nowMs;
    if (existingSubSnap.exists()) {
      const existingData = existingSubSnap.data();
      const existingExpires = existingData.expiresAt as Timestamp | undefined;
      if (
        existingData.status === 'active' &&
        existingExpires &&
        existingExpires.toMillis() > nowMs
      ) {
        baseStartMs = existingExpires.toMillis();
      }
    }

    const startsAt = Timestamp.fromMillis(nowMs);
    const expiresAt = Timestamp.fromMillis(
      baseStartMs + daysToGrant * 24 * 60 * 60 * 1000
    );

    // Ensure planId exists or fallback to 'manual' if plan was removed
    const planSnap = await getDoc(doc(db, 'plans', req.planId));
    const safePlanId = planSnap.exists() ? req.planId : 'manual';

    const subPayload = {
      userEmail: req.userEmail.slice(0, 160),
      userName: req.userName.slice(0, 120),
      planId: safePlanId,
      planName: req.planName.slice(0, 80),
      priceCents: Math.max(0, Math.round(req.priceCents)),
      durationDays: daysToGrant,
      status: 'active' as SubscriptionStatus,
      startsAt,
      expiresAt,
      notes: (adminNote || `Solicitação ${req.id} aprovada`).slice(0, 300),
      updatedBy: adminUid,
      updatedAt: serverTimestamp(),
    };

    if (!existingSubSnap.exists()) {
      await setDoc(subRef, {
        userId: req.userId,
        ...subPayload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(subRef, subPayload);
    }

    await updateDoc(doc(db, 'subscriptionRequests', req.id), {
      status: 'approved',
      adminNote: adminNote.trim().slice(0, 300),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${subPath} | ${reqPath}`);
  }
}

export async function rejectRequestByAdmin(
  requestId: string,
  adminNote: string
): Promise<void> {
  const path = `subscriptionRequests/${requestId}`;
  try {
    await updateDoc(doc(db, 'subscriptionRequests', requestId), {
      status: 'rejected',
      adminNote: adminNote.trim().slice(0, 300),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function upsertSubscriptionByAdmin(params: {
  userId: string;
  userEmail: string;
  userName: string;
  planId: string;
  planName: string;
  priceCents: number;
  durationDays: number;
  status: SubscriptionStatus;
  startsAt: Date;
  expiresAt: Date;
  notes: string;
  adminUid: string;
}): Promise<void> {
  const path = `subscriptions/${params.userId}`;
  const ref = doc(db, 'subscriptions', params.userId);

  try {
    const snap = await getDoc(ref);
    let safePlanId = params.planId || 'manual';
    if (safePlanId !== 'manual') {
      const planSnap = await getDoc(doc(db, 'plans', safePlanId));
      if (!planSnap.exists()) {
        safePlanId = 'manual';
      }
    }

    const payload = {
      userEmail: params.userEmail.trim().slice(0, 160),
      userName: (params.userName.trim() || params.userEmail.split('@')[0] || 'Assinante').slice(0, 120),
      planId: safePlanId,
      planName: (params.planName.trim() || 'Plano Personalizado').slice(0, 80),
      priceCents: Math.max(0, Math.min(10000000, Math.round(params.priceCents))),
      durationDays: Math.max(1, Math.min(36500, Math.round(params.durationDays))),
      status: params.status,
      startsAt: Timestamp.fromDate(params.startsAt),
      expiresAt: Timestamp.fromDate(params.expiresAt),
      notes: params.notes.trim().slice(0, 300),
      updatedBy: params.adminUid,
      updatedAt: serverTimestamp(),
    };

    if (!snap.exists()) {
      await setDoc(ref, {
        userId: params.userId,
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function addAdminUser(
  uid: string,
  email: string,
  addedByUid: string
): Promise<void> {
  const path = `admins/${uid}`;
  try {
    await setDoc(doc(db, 'admins', uid), {
      uid,
      email: email.trim().slice(0, 160),
      addedBy: addedByUid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeAdminUser(uid: string): Promise<void> {
  const path = `admins/${uid}`;
  try {
    await deleteDoc(doc(db, 'admins', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
