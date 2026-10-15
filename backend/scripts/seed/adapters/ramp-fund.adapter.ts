/**
 * Ramp Fund Database Adapter
 *
 * Maps Ramp VC & Angel Email Database CSV rows → InvestorRecord Prisma create input.
 * Designed for vendor isolation: if you switch data providers, write a new adapter
 * with the same output shape — zero changes to the loader.
 */

import type { Prisma } from '@prisma/client';

const DATA_SOURCE = 'ramp';

/** Mapping from Ramp "Fund Type" → our investorType enum */
const FUND_TYPE_MAP: Record<string, string> = {
  'venture fund': 'vc',
  'angel network': 'angel',
  'corporate vc': 'corporate',
  'family office': 'family_office',
  'accelerator': 'accelerator',
};

/** Normalize "Series A" → "series-a", "Pre-Seed" → "pre-seed" */
function normalizeStage(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-');
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
  const name = (row['Investor Name'] || row['\uFEFFInvestor Name'] || '').trim().toLowerCase();
  const email = (row['Partner Email'] || '').trim().toLowerCase();
  // Name+email gives best dedup; fall back to name-only if no email
  return email ? `${name}::${email}` : name;
}

/** Compute a 0-100 data quality score based on field completeness */
function computeQuality(row: Record<string, string>): number {
  const checks = [
    row['Investor Name'] || row['\uFEFFInvestor Name'],
    row['Partner Email'],
    row['Partner Name'],
    row['Fund Type'],
    row['Fund Stage'],
    row['Fund Focus (Sectors)'],
    row['Website (if available)'],
    row['Location'],
    row['LinkedIn Link'],
    row['Fund Description'],
    row['Founding Year'],
    row['Number of Investments'],
  ];
  const filled = checks.filter((v) => v && v.trim().length > 0).length;
  return Math.round((filled / checks.length) * 100);
}

export interface AdaptedFundRecord {
  data: Prisma.InvestorRecordCreateInput;
  sourceId: string;
}

/**
 * Adapt a single CSV row into a Prisma InvestorRecord create input.
 * Returns null if the row is a disclaimer or empty.
 */
export function adaptFundRow(
  row: Record<string, string>,
  extraTags: string[] = [],
): AdaptedFundRecord | null {
  const investorName = (row['Investor Name'] || row['\uFEFFInvestor Name'] || '').trim();

  // Skip disclaimer rows and empties
  if (!investorName || investorName.startsWith('Information is retrieved')) {
    return null;
  }

  const fundType = (row['Fund Type'] || '').trim().toLowerCase();
  const stages = splitList(row['Fund Stage']).map(normalizeStage);
  const sectors = splitList(row['Fund Focus (Sectors)']);
  const portfolioRaw = splitList(row['Portfolio Companies']);
  const location = (row['Location'] || '').trim();

  // Build tags
  const tags: string[] = ['ramp:fund_database', ...extraTags];
  if (fundType === 'angel network') tags.push('ramp:angel_investors');
  for (const stage of stages) {
    tags.push(`ramp:${stage}`);
  }

  const sourceId = buildSourceId(row);

  const data: Prisma.InvestorRecordCreateInput = {
    name: investorName,
    fundName: investorName, // In Ramp data, investor name IS the fund name
    email: row['Partner Email']?.trim() || null,
    investorType: FUND_TYPE_MAP[fundType] || 'vc',
    stageFocus: stages,
    sectorFocus: sectors,
    geography: location ? [location] : [],
    website: row['Website (if available)']?.trim() || null,
    linkedinUrl: row['LinkedIn Link']?.trim() || null,
    twitterHandle: row['Twitter Link']?.trim() || null,
    facebookUrl: row['Facebook Link']?.trim() || null,
    partnerName: row['Partner Name']?.trim() || null,
    partnerEmail: row['Partner Email']?.trim() || null,
    thesisSummary: row['Fund Description']?.trim() || null,
    portfolioCompanies: portfolioRaw.length > 0 ? portfolioRaw : undefined,
    investmentCount18mo: parseIntOrNull(row['Number of Investments']) ?? 0,
    numberOfExits: parseIntOrNull(row['Number of Exits']),
    foundingYear: parseIntOrNull(row['Founding Year']),
    dataSource: DATA_SOURCE,
    dataSourceId: sourceId,
    dataSourceTags: [...new Set(tags)], // deduplicate
    dataQualityScore: computeQuality(row),
    lastEnrichedAt: new Date(),
  };

  return { data, sourceId };
}
