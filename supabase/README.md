# Supabase — Manas Day 3 Infrastructure

This directory contains Supabase migrations and operational documentation.

## Running Migrations

Apply migrations using the Supabase CLI or the Supabase Dashboard SQL Editor:

```bash
# Using Supabase CLI
npx supabase db push

# Or copy the contents of migrations/001_day3_core_tables.sql
# into the Supabase Dashboard SQL Editor and execute.
```

## Seeding Demo Data

Seed the `providers` table with fictional demo clinicians:

```bash
npm run seed:supabase
```

> The seed script uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS.
> It inserts only into `providers` — all other tables are populated by the app.

## RLS Boundary Summary

| Table               | Read                                  | Write                          |
|---------------------|---------------------------------------|--------------------------------|
| `profiles`          | Own row only (`auth.uid() = id`)      | Via service_role only          |
| `check_in_sessions` | Own rows (`auth.uid() = user_id`)     | Own rows (ALL)                 |
| `safety_assessments`| Own sessions (subquery on sessions)   | Via service_role only          |
| `providers`         | **Public** (fictional demo data)      | Via service_role only          |
| `handoffs`          | Own rows (`auth.uid() = user_id`)     | Own rows (ALL)                 |
| `audit_events`      | Own rows (`auth.uid() = user_id`)     | **service_role only**          |

## Service-Role Key Security

`SUPABASE_SERVICE_ROLE_KEY` bypasses **all** RLS policies.

- Never expose it in browser bundles or client-side code.
- Use only in:
  - Seed scripts (`scripts/seed-supabase.ts`)
  - Background migration jobs
  - `SupabaseAuditLogger.log()` (server-side only)
- Protected at the code level via `import 'server-only'` in `supabase-client.ts`.

## Schema Notes

### `providers.profile_id` is Nullable

`profile_id` maps to `profiles.id` for clinician authorization, but is **nullable**:
- Fictional demo providers do not have a linked auth account.
- Real clinicians (future) will have `profile_id = auth.uid()`.
- Queries for "my provider profile" use `providers.profile_id = auth.uid()`, NOT `providers.id`.

## Test User Creation

For integration/E2E testing, create a test user via Supabase Auth:

```typescript
const { data } = await supabase.auth.signUp({
  email: 'test@example.com',
  password: 'test-password-123',
});
// data.user.id is the UUID used in profiles, check_in_sessions, handoffs, etc.
```

After sign-up, insert a matching row into `profiles` (using the service_role client if RLS blocks it).
