/**
 * Generic Batch Loader
 *
 * Handles idempotent upsert by (dataSource, dataSourceId).
 * Works for both InvestorRecord and CompanyRecord — any entity
 * with the vendor-agnostic provenance columns.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const BATCH_SIZE = 100;

export interface LoadResult {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  total: number;
}

export async function loadInvestors(
  prisma: PrismaClient,
  records: { data: Prisma.InvestorRecordCreateInput; sourceId: string }[],
): Promise<LoadResult> {
  const result: LoadResult = { created: 0, updated: 0, skipped: 0, errors: 0, total: records.length };

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);

    for (const { data, sourceId } of batch) {
      try {
        if (!sourceId) {
          result.skipped++;
          continue;
        }

        const existing = await prisma.investorRecord.findFirst({
          where: {
            dataSource: data.dataSource as string,
            dataSourceId: sourceId,
          },
        });

        if (existing) {
          // Merge tags: keep existing tags + add new ones
          const existingTags = (existing.dataSourceTags as string[]) || [];
          const newTags = (data.dataSourceTags as string[]) || [];
          const mergedTags = [...new Set([...existingTags, ...newTags])];

          await prisma.investorRecord.update({
            where: { id: existing.id },
            data: {
              ...data,
              dataSourceTags: mergedTags,
            },
          });
          result.updated++;
        } else {
          await prisma.investorRecord.create({ data });
          result.created++;
        }
      } catch (err: any) {
        result.errors++;
        if (result.errors <= 5) {
          console.error(`  ⚠ Error on "${data.name}": ${err.message}`);
        }
      }
    }

    const pct = Math.round(((i + batch.length) / records.length) * 100);
    console.log(
      `  Batch ${batchNum}/${totalBatches} done (${pct}%) — ${result.created} created, ${result.updated} updated`,
    );
  }

  return result;
}

export async function loadCompanies(
  prisma: PrismaClient,
  records: { data: Prisma.CompanyRecordCreateInput; sourceId: string }[],
): Promise<LoadResult> {
  const result: LoadResult = { created: 0, updated: 0, skipped: 0, errors: 0, total: records.length };

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);

    for (const { data, sourceId } of batch) {
      try {
        if (!sourceId) {
          result.skipped++;
          continue;
        }

        const existing = await prisma.companyRecord.findFirst({
          where: {
            dataSource: data.dataSource as string,
            dataSourceId: sourceId,
          },
        });

        if (existing) {
          const existingTags = (existing.dataSourceTags as string[]) || [];
          const newTags = (data.dataSourceTags as string[]) || [];
          const mergedTags = [...new Set([...existingTags, ...newTags])];

          await prisma.companyRecord.update({
            where: { id: existing.id },
            data: {
              ...data,
              dataSourceTags: mergedTags,
            },
          });
          result.updated++;
        } else {
          await prisma.companyRecord.create({ data });
          result.created++;
        }
      } catch (err: any) {
        result.errors++;
        if (result.errors <= 5) {
          console.error(`  ⚠ Error on "${data.name}": ${err.message}`);
        }
      }
    }

    const pct = Math.round(((i + batch.length) / records.length) * 100);
    console.log(
      `  Batch ${batchNum}/${totalBatches} done (${pct}%) — ${result.created} created, ${result.updated} updated`,
    );
  }

  return result;
}
