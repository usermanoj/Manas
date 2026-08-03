import { NextRequest, NextResponse } from 'next/server';
import { createServices, createAuthService } from '@/lib/services';
import { createSession } from '@/domain/auth';
import { z } from 'zod';

const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1).max(100),
  isAdultConfirmed: z.literal(true),
  consentToContact: z.boolean(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = RegisterRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid registration data.', details: parsed.error.format() }, { status: 400 });
    }

    const services = createServices();
    const authService = createAuthService(services);
    const result = await authService.registerUser(parsed.data);

    await createSession({
      sub: result.id,
      email: result.email,
      displayName: result.displayName,
      role: result.role,
    });

    return NextResponse.json({ user: result }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Registration failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
