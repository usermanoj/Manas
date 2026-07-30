import { StructuredCheckIn } from '../ai/schemas';

/**
 * Domain entity types — matching the 12 database tables.
 */

export interface Profile {
  id: string;
  displayName: string;
  role: 'user' | 'clinician' | 'admin';
  createdAt: Date;
}

export interface UserPreferences {
  id: string;
  userId: string;
  language: 'en' | 'hi' | 'hi-hinglish';
  mode: 'GUEST' | 'CONNECTED_CARE';
}

export interface ConsentRecord {
  id: string;
  userId: string;
  consentType: string;
  status: 'GRANTED' | 'REVOKED' | 'EXPIRED';
  grantedAt: Date;
  revokedAt?: Date;
  expiresAt: Date;
  scope: Record<string, unknown>;
  handoffId?: string;
}

export interface CheckInSession {
  id: string;
  userId: string;
  mode: 'GUEST' | 'CONNECTED_CARE';
  language: 'en' | 'hi' | 'hi-hinglish';
  status: string;
  modelVersion: string;
  promptVersion: string;
  startedAt: Date;
  completedAt?: Date;
  structuredSummary?: StructuredCheckIn;
}

export interface SafetyAssessment {
  id: string;
  sessionId: string;
  preGenResult: Record<string, unknown>;
  postGenResult: Record<string, unknown>;
  routingState: string;
  policyVersion: string;
  createdAt: Date;
}

export interface ContentModule {
  id: string;
  title: string;
  purpose: string;
  status: string;
  currentVersionId?: string;
  primaryLanguage: 'en' | 'hi' | 'hi-hinglish';
}

export interface ContentModuleVersion {
  id: string;
  moduleId: string;
  versionNumber: number;
  steps: Record<string, unknown>[];
  warnings: string[];
  contraindications: string[];
  escalationConditions: string[];
  language: 'en' | 'hi' | 'hi-hinglish';
  reviewStatus: string;
  translationStatus: string;
}

/**
 * Provider — clinician listing record.
 *
 * IMPORTANT: `profileId` maps to `profiles.id` — clinician authorization
 * uses `providers.profile_id = auth.uid()`, NOT `providers.id`.
 */
export interface Provider {
  id: string;
  profileId: string;
  name: string;
  title: string;
  languages: string[];
  focusAreas: string[];
  availability: string;
  sessionType: string;
  priceRange: string;
  bio: string;
  isFictionalDemo: boolean;
}

export interface Handoff {
  id: string;
  userId: string;
  providerId: string;
  status: string;
  structuredSummary: StructuredCheckIn;
  excludedEntries: string[];
  sentAt?: Date;
  version: number;
}

export interface CarePlan {
  id: string;
  userId: string;
  clinicianId: string;
  status: string;
}

export interface CarePlanVersion {
  id: string;
  carePlanId: string;
  versionNumber: number;
  goals: string[];
  assignedModules: string[];
  checkInFrequency: string;
  boundaries: Record<string, unknown>;
  followUpDate?: Date;
  status: string;
  clinicianApprovedAt?: Date;
  userAcceptedAt?: Date;
  createdAt: Date;
}

export interface AuditEvent {
  id: string;
  timestamp: Date;
  requestId: string;
  userId: string;
  actor: string;
  eventType: string;
  details: Record<string, unknown>;
  policyVersion?: string;
  modelVersion?: string;
  promptVersion?: string;
}

/**
 * Generic repository interface.
 * The future Supabase adapter will implement this same interface.
 */
export interface Repository<T extends { id: string }> {
  findById(id: string): Promise<T | null>;
  findAll(filter?: Partial<T>): Promise<T[]>;
  create(entity: T): Promise<T>;
  update(id: string, updates: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
}
