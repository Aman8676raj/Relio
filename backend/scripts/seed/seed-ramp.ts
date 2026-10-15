#!/usr/bin/env npx ts-node
/**
 * Ramp Data Seed CLI
 *
 * Seeds the Ramp VC & Angel Email Database and Company Database into Postgres.
 * Idempotent: safe to re-run — existing records are updated, never duplicated.
 *
 * Usage:
 *   # Seed everything (fund main + angels + companies)
 *   npx ts-node scripts/seed/seed-ramp.ts
 *
 *   # Seed only funds
 *   npx ts-node scripts/seed/seed-ramp.ts --type fund
 *
 *   # Seed only companies
 *   npx ts-node scripts/seed/seed-ramp.ts --type company
 *
 *   # Production (just set DATABASE_URL)
 *   DATABASE_URL="postgresql://user:pass@host:5432/db" npx ts-node scripts/seed/seed-ramp.ts
 */

import { PrismaClient } from '@prisma/client';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse';
import { adaptFundRow, AdaptedFundRecord } from './adapters/ramp-fund.adapter';
import { adaptCompanyRow, AdaptedCompanyRecord } from './adapters/ramp-company.adapter';
import { loadInvestors, loadCompanies, LoadResult } from './loader';

const DATA_DIR = join(__dirname, 'data');

// ── CSV file configuration ────────────────────────────────────────────────────
// Main fund DB: all VCs + funds
// Angel investors CSV: gets the extra tag "ramp:angel_investors"
// Company DB: all companies, tagged by funding status

interface FundFileConfig {
  path: string;
  extraTags: string[];
  label: string;
}

const FUND_FILES: FundFileConfig[] = [
  // ── Process order matters: main first so view-only records are created,
  //    then view files overlay additional tags onto existing records.
  {
    path: join(DATA_DIR, 'ramp-fund-main.csv'),
    extraTags: [],
    label: 'Fund Database (main — Ramp full export)',
  },
  {
    // Angel-only records + tags existing fund records that are also angels
    path: join(DATA_DIR, 'ramp-fund-angels.csv'),
    extraTags: ['ramp:angel_investors'],
    label: 'Angel Investors view',
  },
  {
    // Records without a website — processed to capture unique records in this view
    path: join(DATA_DIR, 'Fund Database-website is empty (1).csv'),
    extraTags: ['ramp:website_empty'],
    label: 'Website Empty view',
  },
  {
    // Records that are missing partner name/email
    path: join(DATA_DIR, 'Fund Database-Missing Partner Name_Email.csv'),
    extraTags: ['ramp:missing_partner'],
    label: 'Missing Partner view',
  },
  {
    // Records missing founding year
    path: join(DATA_DIR, 'Fund Database-Missing founding date (WIP).csv'),
    extraTags: ['ramp:missing_founding_date'],
    label: 'Missing Founding Date view',
  },
  {
    // Small curated "full database" view
    path: join(DATA_DIR, 'Fund Database-full database.csv'),
    extraTags: ['ramp:full_database'],
    label: 'Full Database view',
  },
  {
    // Ready to pull — very small, catches any new records
    path: join(DATA_DIR, 'Fund Database-Ready to pull.csv'),
    extraTags: ['ramp:ready_to_pull'],
    label: 'Ready to Pull view',
  },
  {
    // Already pulled — overlaps heavily with main, but catches any not in main
    path: join(DATA_DIR, 'Fund Database-Already Pulled.csv'),
    extraTags: ['ramp:already_pulled'],
    label: 'Already Pulled view',
  },
];

const COMPANY_FILE = join(DATA_DIR, 'ramp-companies.csv');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function parseCSV(filePath: string): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    createReadStream(filePath, { encoding: 'utf-8' })
      .pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          bom: true, // Strip BOM
          relax_column_count: true,
          trim: true,
        }),
      )
      .on('data', (row: Record<string, string>) => rows.push(row))
      .on('error', reject)
      .on('end', () => resolve(rows));
  });
}

function printResult(label: string, result: LoadResult) {
  console.log(`\n📊 ${label}:`);
  console.log(`   Created:  ${result.created}`);
  console.log(`   Updated:  ${result.updated}`);
  console.log(`   Skipped:  ${result.skipped}`);
  console.log(`   Errors:   ${result.errors}`);
  console.log(`   Total:    ${result.total}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function seedFunds(prisma: PrismaClient) {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  📂 SEEDING FUND DATABASE');
  console.log('═══════════════════════════════════════════════════');

  // Process fund files in order: main first, then angels
  // The angel file adds the "ramp:angel_investors" tag.
  // If a record appears in both, the loader merges tags on update.

  for (const fileConfig of FUND_FILES) {
    if (!existsSync(fileConfig.path)) {
      console.log(`\n⏭  Skipping ${fileConfig.label} — file not found: ${fileConfig.path}`);
      continue;
    }

    console.log(`\n📄 Processing: ${fileConfig.label}`);
    console.log(`   File: ${fileConfig.path}`);
    if (fileConfig.extraTags.length > 0) {
      console.log(`   Extra tags: ${fileConfig.extraTags.join(', ')}`);
    }

    const rows = await parseCSV(fileConfig.path);
    console.log(`   Parsed ${rows.length} CSV rows`);

    // Adapt rows
    const adapted: AdaptedFundRecord[] = [];
    for (const row of rows) {
      const result = adaptFundRow(row, fileConfig.extraTags);
      if (result) adapted.push(result);
    }
    console.log(`   Adapted ${adapted.length} valid records (skipped ${rows.length - adapted.length} disclaimers/empties)\n`);

    const result = await loadInvestors(prisma, adapted);
    printResult(fileConfig.label, result);
  }
}

async function seedCompanies(prisma: PrismaClient) {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  📂 SEEDING COMPANY DATABASE');
  console.log('═══════════════════════════════════════════════════');

  if (!existsSync(COMPANY_FILE)) {
    console.log(`\n⏭  Skipping Company Database — file not found: ${COMPANY_FILE}`);
    return;
  }

  console.log(`\n📄 Processing: Company Database`);
  console.log(`   File: ${COMPANY_FILE}`);

  const rows = await parseCSV(COMPANY_FILE);
  console.log(`   Parsed ${rows.length} CSV rows`);

  const adapted: AdaptedCompanyRecord[] = [];
  for (const row of rows) {
    const result = adaptCompanyRow(row);
    if (result) adapted.push(result);
  }
  console.log(`   Adapted ${adapted.length} valid records (skipped ${rows.length - adapted.length} disclaimers/empties)\n`);

  const result = await loadCompanies(prisma, adapted);
  printResult('Company Database', result);
}

async function main() {
  const args = process.argv.slice(2);
  const typeArg = args.includes('--type') ? args[args.indexOf('--type') + 1] : 'all';

  console.log('🚀 Ramp Data Seed');
  console.log(`   Type: ${typeArg}`);
  console.log(`   Database: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@') || '(from prisma config)'}`);
  console.log(`   Data dir: ${DATA_DIR}`);

  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    console.log('   ✅ Database connected');

    if (typeArg === 'all' || typeArg === 'fund') {
      await seedFunds(prisma);
    }

    if (typeArg === 'all' || typeArg === 'company') {
      await seedCompanies(prisma);
    }

    // Final counts
    const investorCount = await prisma.investorRecord.count();
    const companyCount = await prisma.companyRecord.count();

    console.log('\n═══════════════════════════════════════════════════');
    console.log('  🎉 SEED COMPLETE');
    console.log(`   Investor records: ${investorCount}`);
    console.log(`   Company records:  ${companyCount}`);
    console.log('═══════════════════════════════════════════════════\n');
  } catch (err: any) {
    console.error(`\n❌ Fatal error: ${err.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
