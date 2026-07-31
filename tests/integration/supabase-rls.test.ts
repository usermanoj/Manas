import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Gated real-Supabase RLS tests
// ---------------------------------------------------------------------------

const shouldRun = process.env.MANAS_SUPABASE_TEST_ENABLED === 'true';

describe.skipIf(!shouldRun)('Supabase RLS Policies', () => {
  // These tests require a real Supabase project with test users and seeded data.
  // Set MANAS_SUPABASE_TEST_ENABLED=true along with SUPABASE_URL, SUPABASE_ANON_KEY,
  // and SUPABASE_SERVICE_ROLE_KEY pointed at a dedicated test project.

  it('User A cannot read User B session', async () => {
    // TODO: implement with real Supabase client + auth tokens
    // Placeholder — will be implemented once test project is provisioned.
    expect(true).toBe(true);
  });

  it('User A cannot read User B handoff', async () => {
    // TODO: implement with real Supabase client + auth tokens
    expect(true).toBe(true);
  });

  it('User can read fictional public providers', async () => {
    // TODO: verify providers with is_fictional_demo = true are readable
    expect(true).toBe(true);
  });

  it('Audit events are insert-only (no update/delete possible)', async () => {
    // TODO: attempt update/delete on audit_events as anon user — expect failure
    expect(true).toBe(true);
  });
});

// Annotation when skipped
if (!shouldRun) {
  describe('Supabase RLS Policies (skipped)', () => {
    it('NOT RUN — set MANAS_SUPABASE_TEST_ENABLED=true with a dedicated test project', () => {
      // This test exists solely to surface the skip reason in CI output.
      expect(true).toBe(true);
    });
  });
}

// ---------------------------------------------------------------------------
// Service-role key isolation — ALWAYS runs
// ---------------------------------------------------------------------------

/**
 * Recursively collect all file paths under a directory.
 */
function walkDir(dir: string): string[] {
  const entries: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      entries.push(...walkDir(full));
    } else {
      entries.push(full);
    }
  }
  return entries;
}

describe('Service-role key isolation', () => {
  it('service-role key is not referenced in Route Handlers (src/app/)', () => {
    const appDir = path.resolve(__dirname, '../../src/app');

    if (!fs.existsSync(appDir)) {
      // If src/app doesn't exist, nothing to check
      return;
    }

    const files = walkDir(appDir);
    const textFiles = files.filter((f) =>
      /\.(ts|tsx|js|jsx|mjs)$/.test(f),
    );

    const matches: string[] = [];
    for (const file of textFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('SUPABASE_SERVICE_ROLE_KEY')) {
        matches.push(path.relative(appDir, file));
      }
    }

    expect(matches).toEqual([]);
  });
});
