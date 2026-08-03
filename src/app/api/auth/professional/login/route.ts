import { NextRequest, NextResponse } from 'next/server';
import { createServices, createAuthService } from '@/lib/services';
import { createSession } from '@/domain/auth';
import { z } from 'zod';

const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = LoginRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid login data.', details: parsed.error.format() }, { status: 400 });
    }

    const services = createServices();
    const authService = createAuthService(services);
    const result = await authService.loginProfessional(parsed.data.email, parsed.data.password);

    await createSession({
      sub: result.id,
      email: result.email,
      displayName: result.displayName,
      role: result.role,
      providerId: result.providerId,
    });

    return NextResponse.json({ user: result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Login failed.';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
