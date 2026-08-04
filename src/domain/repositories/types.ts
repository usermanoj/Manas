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
  /** Display-only price range for the demo. No payments are processed. */
  priceRange: string;
  /** Numeric price per session in USD for filtering and display. */
  pricePerSession: number;
  currency: string;
  sessionDurationMinutes: number;
  nextAvailable: string;
  /**
   * Structured scheduling fields used to convert the provider's local hours
   * into the viewer's selected timezone. All times are in `timezone` local time.
   */
  timezone?: string;
  availabilityDays?: string;
  availabilityStartHour?: number;
  availabilityStartMinute?: number;
  availabilityEndHour?: number;
  availabilityEndMinute?: number;
  nextAvailableDay?: string;
  nextAvailableHour?: number;
  nextAvailableMinute?: number;
  credentialsNote: string;
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
  overallStatus: string;
  activeVersionId: string | null;
  latestVersionId: string;
  createdAt?: Date;
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
  previousVersionId?: string;
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

// ─── Accounts / Auth ───────────────────────────────────────────────────────────

export interface UserAccount {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  dateOfBirth?: string;
  /** Explicitly confirmed adult (18+) during registration. */
  isAdultConfirmed: boolean;
  consentToContact: boolean;
  createdAt: Date;
}

export interface ProfessionalAccount {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  providerId: string;
  role: 'clinician';
  createdAt: Date;
}

// ─── Symptom Tracking ──────────────────────────────────────────────────────────

export type SymptomCategory =
  | 'sleep'
  | 'mood'
  | 'energy'
  | 'focus'
  | 'physical_tension'
  | 'social'
  | 'work_stress'
  | 'other';

export type SymptomSeverity = 'mild' | 'moderate' | 'significant' | 'severe';
export type SymptomFrequency =
  | 'occasionally'
  | 'weekly'
  | 'several_times_a_week'
  | 'daily'
  | 'constant';

export interface SymptomEntry {
  id: string;
  userId: string;
  sessionId?: string;
  text: string;
  category: SymptomCategory;
  severity: SymptomSeverity;
  frequency: SymptomFrequency;
  impact: string;
  createdAt: Date;
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
