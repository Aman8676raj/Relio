/**
 * Seed Script for Investor Database
 * 
 * This script reads a JSON file of investor data and seeds it into the database
 * via the API endpoint POST /api/investors/seed.
 * 
 * Usage:
 *   1. Place your Crunchbase export JSON in this directory as `investors.json`
 *   2. Run: npx ts-node scripts/seed-investors.ts
 * 
 * Expected JSON format (array of objects):
 * [
 *   {
 *     "name": "Sequoia Capital",
 *     "fund_name": "Sequoia Capital Fund XVI",
 *     "fund_size_usd": 6000000000,
 *     "fund_vintage_year": 2022,
 *     "investor_type": "vc",
 *     "stage_focus": ["seed", "series-a", "series-b"],
 *     "sector_focus": ["enterprise", "fintech", "healthcare"],
 *     "geography": ["United States", "India", "Southeast Asia"],
 *     "typical_check_min_usd": 500000,
 *     "typical_check_max_usd": 50000000,
 *     "website": "https://www.sequoiacap.com",
 *     "linkedin_url": "https://linkedin.com/company/sequoia-capital",
 *     "thesis_summary": "Partner with daring founders who ...",
 *     "recent_investments": [
 *       {"company": "Stripe", "amount": 100000000, "date": "2025-03-01", "sector": "fintech", "stage": "series-c"}
 *     ],
 *     "investment_count_18mo": 24,
 *     "is_actively_deploying": true,
 *     "crunchbase_id": "sequoia-capital"
 *   }
 * ]
 * 
 * The seed endpoint handles both snake_case and camelCase field names.
 * Records with a crunchbase_id will be upserted (updated if existing).
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SEED_FILE = process.env.SEED_FILE || join(__dirname, 'investors.json');
const BATCH_SIZE = 50;

async function main() {
  // Check if file exists
  if (!existsSync(SEED_FILE)) {
    console.error(`\n❌ Seed file not found: ${SEED_FILE}`);
    console.error(`\nPlease create the file with your Crunchbase export data.`);
    console.error(`See the comment at the top of this script for the expected format.\n`);
    process.exit(1);
  }

  console.log(`📂 Reading investor data from: ${SEED_FILE}`);
  const raw = readFileSync(SEED_FILE, 'utf-8');
  let investors: any[];

  try {
    investors = JSON.parse(raw);
  } catch {
    console.error('❌ Failed to parse JSON file');
    process.exit(1);
  }

  if (!Array.isArray(investors)) {
    console.error('❌ JSON must be an array of investor objects');
    process.exit(1);
  }

  console.log(`📊 Found ${investors.length} investor records`);
  console.log(`🚀 Seeding in batches of ${BATCH_SIZE}...\n`);

  let totalCreated = 0;
  let totalUpdated = 0;

  // Process in batches
  for (let i = 0; i < investors.length; i += BATCH_SIZE) {
    const batch = investors.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(investors.length / BATCH_SIZE);

    try {
      const response = await fetch(`${API_URL}/api/investors/seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ investors: batch }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`❌ Batch ${batchNum}/${totalBatches} failed: ${error}`);
        continue;
      }

      const result = await response.json();
      totalCreated += result.created;
      totalUpdated += result.updated;

      console.log(
        `  ✅ Batch ${batchNum}/${totalBatches}: ${result.created} created, ${result.updated} updated`,
      );
    } catch (err: any) {
      console.error(`❌ Batch ${batchNum}/${totalBatches} error: ${err.message}`);
    }
  }

  console.log(`\n🎉 Seed complete!`);
  console.log(`   Created: ${totalCreated}`);
  console.log(`   Updated: ${totalUpdated}`);
  console.log(`   Total:   ${totalCreated + totalUpdated}\n`);
}

main().catch(console.error);
