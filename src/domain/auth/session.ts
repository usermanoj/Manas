import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

const COOKIE_NAME = 'manas_session';

export interface SessionPayload {
  sub: string;
  email: string;
  displayName: string;
  role: 'user' | 'clinician';
  providerId?: string;
}

/**
 * Returns the secret key used to sign session tokens.
 * In production this must be a strong, randomly generated secret.
 */
function getSecret(): Uint8Array {
  const secret = process.env.MANAS_SESSION_SECRET;
  if (!secret) {
    // Fallback for local demo only. NOT for production.
    return new TextEncoder().encode('manas-demo-secret-change-in-production');
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(payload: SessionPayload): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .setSubject(payload.sub)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return token;
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function requireUser(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || session.role !== 'user') {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function requireProfessional(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || session.role !== 'clinician') {
    throw new Error('Unauthorized');
  }
  return session;
}
