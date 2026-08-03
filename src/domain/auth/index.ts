export { hashPassword, verifyPassword } from './password';
export { AuthService } from './service';
export type { AuthServiceDeps, UserRegistrationInput, AuthResult } from './service';
export {
  createSession,
  getSession,
  clearSession,
  requireUser,
  requireProfessional,
} from './session';
export type { SessionPayload } from './session';
