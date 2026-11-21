import type { Timestamp } from 'firebase/firestore';

export interface SubscriptionPlan {
  id: string;
  name: string;
  billingLabel: string;
  description: string;
  priceCents: number;
  durationDays: number;
  features: string[];
  active: boolean;
  highlighted: boolean;
  sortOrder: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface BillingSettings {
  paywallEnabled: boolean;
  pixKey: string;
  paymentLink: string;
  paymentInstructions: string;
  supportContact: string;
  creatorPhotoUrl?: string;
  updatedAt?: Timestamp | null;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type SubscriptionStatus = 'active' | 'expired' | 'suspended';

export interface UserSubscription {
  userId: string;
  userEmail: string;
  userName: string;
  planId: string;
  planName: string;
  priceCents: number;
  durationDays: number;
  status: SubscriptionStatus;
  startsAt: Timestamp | null;
  expiresAt: Timestamp | null;
  notes: string;
  updatedBy: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface SubscriptionRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  planId: string;
  planName: string;
  priceCents: number;
  durationDays: number;
  paymentReference: string;
  status: RequestStatus;
  adminNote: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface AdminUser {
  uid: string;
  email: string;
  addedBy: string;
  createdAt?: Timestamp | null;
}

export interface ShowcaseItem {
  id: string;
  title: string;
  category: string;
  gameTitle: string;
  version: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  actionUrl: string;
  highlights: string[];
  published: boolean;
  featured: boolean;
  sortOrder: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}
