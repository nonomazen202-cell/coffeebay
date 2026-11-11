/**
 * Maintenance script to extend expiration date for drink entitlements (vouchers).
 * Specifically updates active (ISSUED) vouchers of Cairo Flagship Opening campaign
 * to the extended expiration date: November 18, 2026.
 */
import fs from 'fs';
import path from 'path';
import { getPayloadClient } from '../lib/payload';
import { sql } from 'drizzle-orm';

// ─── 1. Load Environment Variables from .env ──────────────────────────────
function loadEnv(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        let val = trimmed.substring(idx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    }
  }
}

async function main() {
  loadEnv();
  console.log('--- Extend Vouchers Expiry Maintenance Script ---');
  const payload = await getPayloadClient();

  // 1. Fetch Cairo Flagship Opening campaign
  const campaignRes = await payload.db.drizzle.execute(sql`
    SELECT id, title, slug, end_date FROM drink_campaigns
    WHERE slug = 'cairo-opening' OR id = 1
    LIMIT 1
  `);

  if (!campaignRes.rows || campaignRes.rows.length === 0) {
    console.error('❌ Campaign not found!');
    process.exit(1);
  }

  const campaign = campaignRes.rows[0] as { id: number; title: string; slug: string; end_date: string };
  console.log(`Campaign found: ID=${campaign.id}, Title="${campaign.title}", Current end_date="${campaign.end_date}"`);

  // Target expiry date: November 18, 2026 23:59:59 Cairo time (21:59:59 UTC)
  const targetExpiryIso = new Date('2026-11-18T21:59:59.000Z').toISOString();
  console.log(`Target Expiry Date (ISO): ${targetExpiryIso}`);

  // 2. Fetch all vouchers currently in campaign before update
  const vouchersBefore = await payload.db.drizzle.execute(sql`
    SELECT id, voucher_code, customer_name, phone, status, expires_at
    FROM drink_entitlements
    WHERE campaign_id = ${campaign.id}
    ORDER BY id ASC
  `);

  console.log(`\n📋 Found ${vouchersBefore.rows.length} total vouchers in campaign before update:`);
  console.table(vouchersBefore.rows);

  // 3. Update active ISSUED vouchers to new target expiry date
  // STRICT SAFETY: Only vouchers that are 'ISSUED' AND have NOT expired yet (expires_at >= NOW())
  // Expired, redeemed, or cancelled vouchers are strictly protected and never touched.
  const updateRes = await payload.db.drizzle.execute(sql`
    UPDATE drink_entitlements
    SET expires_at = ${targetExpiryIso}, updated_at = NOW()
    WHERE campaign_id = ${campaign.id}
      AND status = 'ISSUED'
      AND expires_at >= NOW()
    RETURNING id, voucher_code, customer_name, phone, status, expires_at
  `);

  console.log(`\n✅ Successfully updated ${updateRes.rows.length} active (ISSUED) vouchers:`);
  console.table(updateRes.rows);

  // 4. Also ensure campaign end_date itself is set to Nov 18
  await payload.db.drizzle.execute(sql`
    UPDATE drink_campaigns
    SET end_date = ${targetExpiryIso}, updated_at = NOW()
    WHERE id = ${campaign.id}
  `);
  console.log(`✅ Campaign end_date updated to: ${targetExpiryIso}`);

  console.log('\n--- Finished Successfully ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error running migration:', err);
  process.exit(1);
});

