/**
 * Maintenance script to extend expiration date for drink entitlements (vouchers).
 * Specifically updates active (ISSUED) vouchers of Cairo Flagship Opening campaign
 * to the extended expiration date: November 18, 2026.
 */
import { getPayloadClient } from '../lib/payload';
import { sql } from 'drizzle-orm';

async function main() {
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
  const updateRes = await payload.db.drizzle.execute(sql`
    UPDATE drink_entitlements
    SET expires_at = ${targetExpiryIso}, updated_at = NOW()
    WHERE campaign_id = ${campaign.id}
      AND status = 'ISSUED'
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
