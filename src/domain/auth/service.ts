import type { Repository } from '@/domain/repositories';
import type { UserAccount, ProfessionalAccount } from '@/domain/repositories';
import { hashPassword, verifyPassword } from './password';
import { AuditLogger } from '@/domain/audit';

export interface AuthServiceDeps {
  userAccountRepo: Repository<UserAccount>;
  professionalAccountRepo: Repository<ProfessionalAccount>;
  auditLogger: AuditLogger;
}

export interface UserRegistrationInput {
  email: string;
  password: string;
  displayName: string;
  isAdultConfirmed: boolean;
  consentToContact: boolean;
}

export interface AuthResult {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'clinician';
  providerId?: string;
}

export class AuthService {
  constructor(private deps: AuthServiceDeps) {}

  async registerUser(input: UserRegistrationInput): Promise<AuthResult> {
    const existing = await this.deps.userAccountRepo.findAll({ email: input.email });
    if (existing.length > 0) {
      throw new Error('An account with this email already exists.');
    }

    const account: UserAccount = {
      id: `user-${crypto.randomUUID()}`,
      email: input.email,
      passwordHash: hashPassword(input.password),
      displayName: input.displayName,
      isAdultConfirmed: input.isAdultConfirmed,
      consentToContact: input.consentToContact,
      createdAt: new Date(),
    };

    await this.deps.userAccountRepo.create(account);

    await this.deps.auditLogger.log({
      requestId: account.id,
      userId: account.id,
      actor: 'user',
      eventType: 'USER_REGISTERED',
      details: { email: account.email, displayName: account.displayName },
    });

    return {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      role: 'user',
    };
  }

  async loginUser(email: string, password: string): Promise<AuthResult> {
    const accounts = await this.deps.userAccountRepo.findAll({ email });
    const account = accounts[0];

    if (!account || !verifyPassword(password, account.passwordHash)) {
      await this.deps.auditLogger.log({
        requestId: `login-fail-${Date.now()}`,
        userId: email,
        actor: 'user',
        eventType: 'LOGIN_FAILED',
        details: { email, reason: 'invalid_credentials' },
      });
      throw new Error('Invalid email or password.');
    }

    await this.deps.auditLogger.log({
      requestId: `login-${account.id}`,
      userId: account.id,
      actor: 'user',
      eventType: 'USER_LOGGED_IN',
      details: { email: account.email },
    });

    return {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      role: 'user',
    };
  }

  async loginProfessional(email: string, password: string): Promise<AuthResult> {
    const accounts = await this.deps.professionalAccountRepo.findAll({ email });
    const account = accounts[0];

    if (!account || !verifyPassword(password, account.passwordHash)) {
      await this.deps.auditLogger.log({
        requestId: `pro-login-fail-${Date.now()}`,
        userId: email,
        actor: 'clinician',
        eventType: 'LOGIN_FAILED',
        details: { email, reason: 'invalid_credentials' },
      });
      throw new Error('Invalid email or password.');
    }

    await this.deps.auditLogger.log({
      requestId: `pro-login-${account.id}`,
      userId: account.id,
      actor: 'clinician',
      eventType: 'PROFESSIONAL_LOGGED_IN',
      details: { email: account.email, providerId: account.providerId },
    });

    return {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      role: 'clinician',
      providerId: account.providerId,
    };
  }

  async findUserById(id: string): Promise<AuthResult | null> {
    const account = await this.deps.userAccountRepo.findById(id);
    if (!account) return null;
    return {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      role: 'user',
    };
  }

  async findProfessionalById(id: string): Promise<AuthResult | null> {
    const account = await this.deps.professionalAccountRepo.findById(id);
    if (!account) return null;
    return {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      role: 'clinician',
      providerId: account.providerId,
    };
  }
}
