import 'server-only';
import { createAdminSupabaseClient } from '@/infrastructure/database/supabase-client';
import { SEED_PROVIDERS } from '@/domain/repositories/seed-data';
import { SEED_PROFILES } from '@/domain/repositories/seed-data';
import type { Provider, Profile } from '@/domain/repositories/types';

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Map a domain Profile to the `profiles` table row (snake_case). */
function profileToRow(p: Profile) {
  return {
    id: p.id,
    display_name: p.displayName,
    role: p.role,
    created_at: p.createdAt.toISOString(),
  };
}

/** Map a domain Provider to the `providers` table row (snake_case). */
function providerToRow(p: Provider) {
  return {
    id: p.id,
    profile_id: null, // Day 3: all providers have NULL profile_id
    name: p.name,
    title: p.title,
    languages: p.languages,
    focus_areas: p.focusAreas,
    availability: p.availability,
    session_type: p.sessionType,
    price_range: p.priceRange,
    bio: p.bio,
    is_fictional_demo: p.isFictionalDemo,
  };
}

// ─── Seed logic ─────────────────────────────────────────────────────────────────

async function seed() {
  const supabase = createAdminSupabaseClient();

  // ── 1. Create test users for RLS isolation testing ──────────────────────────

  const testEmail = process.env.SUPABASE_TEST_USER_EMAIL;
  const testPassword = process.env.SUPABASE_TEST_USER_PASSWORD;

  if (!testEmail || !testPassword) {
    console.log(
      '⚠ Skipping test-user creation — SUPABASE_TEST_USER_EMAIL / SUPABASE_TEST_USER_PASSWORD not set',
    );
  } else {
    const testUsers = [
      { email: testEmail, password: testPassword },
      {
        email: testEmail.replace('@', '-secondary@'),
        password: testPassword,
      },
    ];

    for (const u of testUsers) {
      try {
        const { data, error } = await supabase.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
        });

        if (error) {
          // User may already exist — that is acceptable for idempotency
          if (
            error.message.includes('already') ||
            error.message.includes('duplicate') ||
            error.message.includes('exist')
          ) {
            console.log(`✓ Test user ${u.email} already exists — skipping`);
          } else {
            console.error(`✗ Failed to create test user ${u.email}:`, error.message);
          }
        } else {
          console.log(`✓ Created test user ${u.email} (id: ${data.user?.id})`);
        }
      } catch (err) {
        console.error(`✗ Unexpected error creating test user ${u.email}:`, err);
      }
    }
  }

  // ── 2. Seed profiles (demo users: Ananya Sharma & Arjun Mehta) ────────────

  const demoProfiles: Profile[] = SEED_PROFILES.filter((p) => p.role === 'user');

  if (demoProfiles.length === 0) {
    console.log('⚠ No demo user profiles found in SEED_PROFILES');
  } else {
    console.log(`\nSeeding ${demoProfiles.length} profile(s)…`);

    const rows = demoProfiles.map(profileToRow);
    const { data, error } = await supabase
      .from('profiles')
      .upsert(rows, { onConflict: 'id' })
      .select('id');

    if (error) {
      console.error('✗ Failed to upsert profiles:', error.message);
    } else {
      console.log(`✓ Upserted ${data?.length ?? 0} profile(s): ${rows.map((r) => r.id).join(', ')}`);
    }
  }

  // ── 3. Seed providers (3 fictional demo providers) ─────────────────────────

  // Safety gate: every provider MUST be marked isFictionalDemo === true
  const unsafeProviders = SEED_PROVIDERS.filter((p) => !p.isFictionalDemo);
  if (unsafeProviders.length > 0) {
    throw new Error(
      `Refusing to seed: ${unsafeProviders.length} provider(s) do NOT have isFictionalDemo = true: ` +
        unsafeProviders.map((p) => p.id).join(', '),
    );
  }

  console.log(`\nSeeding ${SEED_PROVIDERS.length} provider(s)…`);

  const providerRows = SEED_PROVIDERS.map(providerToRow);
  const { data: providerData, error: providerError } = await supabase
    .from('providers')
    .upsert(providerRows, { onConflict: 'id' })
    .select('id');

  if (providerError) {
    console.error('✗ Failed to upsert providers:', providerError.message);
  } else {
    console.log(
      `✓ Upserted ${providerData?.length ?? 0} provider(s): ${providerRows.map((r) => r.id).join(', ')}`,
    );
  }

  // ── 4. Verify seeded data ─────────────────────────────────────────────────

  console.log('\nVerifying seeded data…');

  const { data: allProviders, error: verifyError } = await supabase
    .from('providers')
    .select('id, is_fictional_demo');

  if (verifyError) {
    console.error('✗ Failed to verify providers:', verifyError.message);
  } else {
    const total = allProviders?.length ?? 0;
    const fictional = (allProviders ?? []).filter(
      (row: { id: string; is_fictional_demo: boolean }) => row.is_fictional_demo === true,
    ).length;
    const nonFictional = total - fictional;

    console.log(`  Providers total: ${total}`);
    console.log(`  Fictional demo:  ${fictional}`);

    if (nonFictional > 0) {
      console.warn(`  ⚠ ${nonFictional} provider(s) are NOT marked as fictional demo`);
    } else {
      console.log('  ✓ All providers are marked as fictional demo');
    }
  }

  console.log('\n✅ Seed completed successfully');
}

seed().catch((err) => {
  console.error('\n❌ Seed script failed:', err);
  process.exit(1);
});
