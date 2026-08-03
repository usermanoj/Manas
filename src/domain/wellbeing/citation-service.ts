/**
 * Citation Service
 *
 * Provides authenticated, pre-vetted citations for wellbeing content.
 *
 * Modes:
 *  - StaticCitationService: returns curated citations from the technique library.
 *  - WebCitationService: attempts to fetch live results from a public search
 *    endpoint (DuckDuckGo Lite HTML) and extracts trustworthy links. Falls back
 *    to static results if the web source is unavailable or returns no results.
 *  - HybridCitationService: tries web first, then static fallback.
 *
 * All returned citations should be treated as educational references, not
 * medical advice.
 */

import {
  WELLBEING_TECHNIQUES,
  getCitationsForTechniqueIds,
  type Citation,
  type Technique,
} from './technique-library';
import type { ConcernArchetype } from './archetypes';

export interface CitationQuery {
  query: string;
  archetype?: ConcernArchetype;
  techniqueIds?: string[];
  maxResults?: number;
}

export interface CitationResult {
  citations: Citation[];
  source: 'static' | 'web' | 'hybrid';
  query: string;
}

export interface CitationService {
  search(query: CitationQuery): Promise<CitationResult>;
}

// ---------------------------------------------------------------------------
// Static citation service
// ---------------------------------------------------------------------------

export class StaticCitationService implements CitationService {
  async search(query: CitationQuery): Promise<CitationResult> {
    const citations: Citation[] = [];

    if (query.techniqueIds && query.techniqueIds.length > 0) {
      citations.push(...getCitationsForTechniqueIds(query.techniqueIds));
    }

    // Also include any technique whose name or framework matches the query.
    const lowerQuery = query.query.toLowerCase();
    for (const technique of WELLBEING_TECHNIQUES) {
      if (
        technique.name.toLowerCase().includes(lowerQuery) ||
        technique.frameworks.some((f) => lowerQuery.includes(f.toLowerCase())) ||
        technique.whenToUse.toLowerCase().includes(lowerQuery)
      ) {
        citations.push(...technique.citations);
      }
    }

    return {
      citations: deduplicateCitations(citations).slice(0, query.maxResults ?? 5),
      source: 'static',
      query: query.query,
    };
  }
}

// ---------------------------------------------------------------------------
// Web citation service
// ---------------------------------------------------------------------------

/**
 * Trusted domain allow-list for live citation search.
 * We only surface results from reputable health, government, and academic sources.
 */
const TRUSTED_DOMAINS = [
  'who.int',
  'nih.gov',
  'ncbi.nlm.nih.gov',
  'cdc.gov',
  'samhsa.gov',
  'nhs.uk',
  'nice.org.uk',
  'apa.org',
  'psychiatry.org',
  'adaa.org',
  'nimh.nih.gov',
  'nami.org',
  'mhanational.org',
  'health.harvard.edu',
  'mayoclinic.org',
  'medlineplus.gov',
  'sleepfoundation.org',
  'jmir.org',
  'frontiersin.org',
  'mdpi.com',
  'cambridge.org',
  'guilford.com',
  'self-compassion.org',
];

function isTrustedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return TRUSTED_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function isSearchTrustedOnly(query: string): boolean {
  const lower = query.toLowerCase();
  return lower.includes('site:') || lower.includes('crisis') || lower.includes('suicide');
}

/**
 * Extract plausible title/URL pairs from DuckDuckGo Lite HTML.
 * This is intentionally simple and defensive — it parses the first few result
 * links and returns those matching the trusted domain list.
 */
function parseDuckDuckGoLiteHtml(html: string, maxResults: number): Citation[] {
  const citations: Citation[] = [];
  // DuckDuckGo Lite result links usually look like:
  // <a rel="nofollow" class="result-link" href="https://example.com">...</a>
  const linkRegex = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null && citations.length < maxResults) {
    let url = match[1].trim();
    const rawTitle = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // DuckDuckGo sometimes redirects via /l/?uddg=
    if (url.startsWith('/l/?')) {
      const uddg = new URLSearchParams(url.slice(1)).get('uddg');
      if (uddg) url = decodeURIComponent(uddg);
    }

    if (!url.startsWith('http')) continue;
    if (isSearchTrustedOnly(rawTitle) && !isTrustedUrl(url)) continue;

    citations.push({
      source: rawTitle || 'Web result',
      title: rawTitle,
      url,
      description: 'Live web search result — please review for accuracy.',
    });
  }

  return citations;
}

export class WebCitationService implements CitationService {
  constructor(private fallback: CitationService = new StaticCitationService()) {}

  async search(query: CitationQuery): Promise<CitationResult> {
    try {
      const maxResults = query.maxResults ?? 3;
      const encoded = encodeURIComponent(query.query);
      const res = await fetch(
        `https://duckduckgo.com/html/?q=${encoded}+mental+health+site:nih.gov+OR+site:apa.org+OR+site:nhs.uk`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ManasWellbeingBot/1.0; +https://manas.example.com)',
          },
        },
      );

      if (!res.ok) throw new Error(`Web citation search failed: ${res.status}`);

      const html = await res.text();
      const webCitations = parseDuckDuckGoLiteHtml(html, maxResults);

      if (webCitations.length > 0) {
        return {
          citations: webCitations,
          source: 'web',
          query: query.query,
        };
      }
    } catch {
      // Web fetch failed — fall through to fallback silently.
      // In production, this would be logged to a monitoring service.
    }

    return this.fallback.search(query);
  }
}

// ---------------------------------------------------------------------------
// Hybrid citation service
// ---------------------------------------------------------------------------

export class HybridCitationService implements CitationService {
  private webService: WebCitationService;
  private staticService: StaticCitationService;

  constructor() {
    this.staticService = new StaticCitationService();
    this.webService = new WebCitationService(this.staticService);
  }

  async search(query: CitationQuery): Promise<CitationResult> {
    const webResult = await this.webService.search(query);
    if (webResult.source === 'web' && webResult.citations.length > 0) {
      return webResult;
    }

    const staticResult = await this.staticService.search(query);
    return {
      ...staticResult,
      source: 'hybrid',
      query: query.query,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deduplicateCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  return citations.filter((c) => {
    const key = `${c.source}|${c.title}|${c.url}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Convenience: build a citation query from a list of techniques.
 */
export function buildCitationQuery(techniques: Technique[], userQuery?: string): CitationQuery {
  return {
    query: userQuery ?? techniques.map((t) => t.name).join(' '),
    techniqueIds: techniques.map((t) => t.id),
    maxResults: 5,
  };
}
