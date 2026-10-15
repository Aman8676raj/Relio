/**
 * Ramp Company Database Adapter
 *
 * Maps Ramp Company Database CSV rows → CompanyRecord Prisma create input.
 * Tags are auto-generated from Funding Status for view-based filtering.
 */

import type { Prisma } from '@prisma/client';

const DATA_SOURCE = 'ramp';

/** Normalize "Series A" → "series_a", "Pre-Seed" → "pre_seed" */
function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/** Split comma/semicolon-separated list, trim, filter empties */
function splitList(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse integer from string, return null if NaN */
function parseIntOrNull(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = parseInt(raw.trim(), 10);
  return isNaN(n) ? null : n;
}

/** Build a stable dedup key for this record */
function buildSourceId(row: Record<string, string>): string {
  const name = (row['Company Name'] || row['\uFEFFCompany Name'] || '').trim().toLowerCase();
  const website = (row['Website'] || '').trim().toLowerCase();
  return website ? `${name}::${website}` : name;
}

export interface AdaptedCompanyRecord {
  data: Prisma.CompanyRecordCreateInput;
  sourceId: string;
}

/**
 * Adapt a single CSV row into a Prisma CompanyRecord create input.
 * Returns null for empty/disclaimer rows.
 */
export function adaptCompanyRow(row: Record<string, string>): AdaptedCompanyRecord | null {
  const companyName = (row['Company Name'] || row['\uFEFFCompany Name'] || '').trim();

  // Skip disclaimer rows and empties
  if (!companyName || companyName.startsWith('Information is retrieved')) {
    return null;
  }

  const fundingStatus = (row['Funding Status'] || '').trim();
  const investors = splitList(row['Investors']);

  // Build tags from funding status
  const tags: string[] = ['ramp:company_database'];
  if (fundingStatus) {
    tags.push(`ramp:${normalizeTag(fundingStatus)}`);
  }

  const sourceId = buildSourceId(row);

  const data: Prisma.CompanyRecordCreateInput = {
    name: companyName,
    website: row['Website']?.trim() || null,
    industry: row['Industry']?.trim() || null,
    fundingStatus: fundingStatus || null,
    oneLiner: row['One Liner']?.trim() || null,
    description: row['Description']?.trim() || null,
    yearFounded: parseIntOrNull(row['Year Founded']),
    lastFunding: row['Last Funding']?.trim() || null,
    totalFunding: row['Total Funding']?.trim() || null,
    investors: investors.length > 0 ? investors : [],
    twitterUrl: row['Twitter']?.trim() || null,
    linkedinUrl: row['LinkedIn']?.trim() || null,
    facebookUrl: row['Facebook']?.trim() || null,
    contactEmail: row['Contact Email']?.trim() || null,
    hqLocation: row['HQ Location']?.trim() || null,
    dataSource: DATA_SOURCE,
    dataSourceId: sourceId,
    dataSourceTags: [...new Set(tags)],
  };

  return { data, sourceId };
}
