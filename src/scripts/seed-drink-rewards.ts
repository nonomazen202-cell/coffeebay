import fs from 'fs';
import path from 'path';
import { getPayload } from 'payload';
import { sql } from 'drizzle-orm';
import { bumpDrinkRewardsCacheVersion } from '../lib/cache/drink-rewards-cache';

// Load .env variables before Payload initialization
function loadEnv(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        let val = trimmed.substring(idx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.substring(1, val.length - 1);
        }
        process.env[trimmed.substring(0, idx).trim()] = val;
      }
    }
  }
}

loadEnv();

const SCRIPTS_DIR = path.resolve(process.cwd(), 'src/scripts');
const MEDIA_DIR = path.resolve(process.cwd(), 'media');

function resolveImageFile(filename: string): string {
  const inMedia = path.join(MEDIA_DIR, filename);
  if (fs.existsSync(inMedia)) return inMedia;
  const inScripts = path.join(SCRIPTS_DIR, filename);
  if (fs.existsSync(inScripts)) return inScripts;
  return inMedia;
}

const DRINK_IMAGE_FILES = {
  chocolateCookieFrappe: resolveImageFile('Coffee Bay Chocolate Cookie Frappé.png'),
  espressoCup: resolveImageFile('COFFEE BAY Espresso Cup Cutout.png'),
  flatWhite: resolveImageFile('Coffee Bay Flat White with Latte Art.png'),
  caramelPeanutFrappe: resolveImageFile('Caramel Peanut Butter Coffee Bay Frappe.png'),
  cappuccino: resolveImageFile('Coffee Bay Latte Art Cup.png'),
};

async function seedDrinkRewards(): Promise<void> {
  console.log('\n======================================================');
  console.log('☕  COFFEE BAY - DRINK REWARDS CLEAN SEEDER (ENGLISH)');
  console.log('📍  Scope: New Drink Rewards System ONLY (Zero Legacy Touch)');
  console.log('======================================================\n');

  const config = (await import('../payload.config')).default;
  const payload = await getPayload({ config });
  const db = payload.db.drizzle;

  // --------------------------------------------------------------------------
  // 0. VERIFY LEGACY SYSTEM COUNTS BEFORE & CLEAR ONLY DRINK REWARDS PARTICIPATIONS
  // --------------------------------------------------------------------------
  console.log('🧹 [0/6] Clearing Drink Rewards participations (preserving Legacy Cup system 100%)...');

  const legacyBefore = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM codes) AS codes_count,
      (SELECT COUNT(*)::int FROM participants) AS participants_count,
      (SELECT COUNT(*)::int FROM entries) AS entries_count,
      (SELECT COUNT(*)::int FROM prize_claims) AS claims_count
  `);
  console.log('  ✓ Legacy system snapshot before:', JSON.stringify(legacyBefore.rows[0]));

  // Delete ONLY Drink Rewards participations, OTP challenges, and Drink Rewards notifications
  const delEntitlements = await db.execute(sql`DELETE FROM drink_entitlements`);
  const delChallenges = await db.execute(sql`DELETE FROM drink_otp_challenges`);
  await db.execute(sql`
    DELETE FROM notifications
    WHERE template IN ('drink-reward-otp', 'drink-reward-voucher', 'drink-reward-admin-alert')
  `);
  await db.execute(sql`UPDATE drink_campaigns SET total_claimed = 0, updated_at = NOW()`);

  console.log(
    `  ✓ Wiped ${delEntitlements.rowCount ?? 0} drink entitlements and ${delChallenges.rowCount ?? 0} drink OTP challenges.`,
  );

  // --------------------------------------------------------------------------
  // 1. SEED OR UPDATE PHYSICAL BRANCH (English + Bilingual Clarity)
  // --------------------------------------------------------------------------
  console.log('\n🏢 [1/6] Configuring Cairo Flagship Branch...');
  let cairoBranch: { id: number; name: string };
  const existingBranch = await payload.find({
    collection: 'branches',
    where: { code: { equals: 'CAIRO-01' } },
    limit: 1,
  });

  const branchData = {
    name: 'Cairo Flagship - New Cairo',
    code: 'CAIRO-01',
    address: 'North 90th Street, Fifth Settlement, New Cairo',
    active: true,
  };

  if (existingBranch.docs.length > 0) {
    cairoBranch = await payload.update({
      collection: 'branches',
      id: existingBranch.docs[0].id,
      data: branchData,
    });
    console.log(`  ✓ Updated branch: ID = ${cairoBranch.id} (${cairoBranch.name})`);
  } else {
    cairoBranch = await payload.create({
      collection: 'branches',
      data: branchData,
    });
    console.log(`  ✓ Created branch: ID = ${cairoBranch.id} (${cairoBranch.name})`);
  }

  // --------------------------------------------------------------------------
  // 2. SEED OR UPDATE DRINK CATEGORIES (English)
  // --------------------------------------------------------------------------
  console.log('\n📂 [2/6] Configuring Drink Categories...');

  let hotCategory: { id: number; name: string };
  const existingHot = await payload.find({
    collection: 'drink-categories',
    where: { slug: { equals: 'hot-drinks' } },
    limit: 1,
  });
  const hotCatData = {
    name: 'Hot Specialty Coffee',
    slug: 'hot-drinks',
    description: 'Handcrafted hot espresso beverages brewed from 100% specialty Arabica beans.',
    active: true,
  };
  if (existingHot.docs.length > 0) {
    hotCategory = await payload.update({
      collection: 'drink-categories',
      id: existingHot.docs[0].id,
      data: hotCatData,
    });
  } else {
    hotCategory = await payload.create({
      collection: 'drink-categories',
      data: hotCatData,
    });
  }
  console.log(`  ✓ Category: ID = ${hotCategory.id} (${hotCategory.name})`);

  let coldCategory: { id: number; name: string };
  const existingCold = await payload.find({
    collection: 'drink-categories',
    where: { slug: { equals: 'cold-drinks' } },
    limit: 1,
  });
  const coldCatData = {
    name: 'Iced Coffee & Frappés',
    slug: 'cold-drinks',
    description: 'Refreshing iced espresso creations and indulgent blended Coffee Bay frappés.',
    active: true,
  };
  if (existingCold.docs.length > 0) {
    coldCategory = await payload.update({
      collection: 'drink-categories',
      id: existingCold.docs[0].id,
      data: coldCatData,
    });
  } else {
    coldCategory = await payload.create({
      collection: 'drink-categories',
      data: coldCatData,
    });
  }
  console.log(`  ✓ Category: ID = ${coldCategory.id} (${coldCategory.name})`);

  // --------------------------------------------------------------------------
  // 3. UPLOAD / RESOLVE MEDIA IMAGES FOR THE 5 DRINKS
  // --------------------------------------------------------------------------
  console.log('\n🖼️  [3/6] Uploading / resolving studio PNG drink images in Payload Media...');

  async function resolveDrinkMedia(
    altText: string,
    filename: string,
    sourcePath: string,
  ): Promise<number> {
    // Check by filename first, then by alt text
    const byFilename = await payload.find({
      collection: 'media',
      where: { filename: { equals: filename } },
      limit: 1,
    });
    if (byFilename.docs.length > 0) {
      return Number(byFilename.docs[0].id);
    }

    const byAlt = await payload.find({
      collection: 'media',
      where: { alt: { equals: altText } },
      limit: 1,
    });
    if (byAlt.docs.length > 0) {
      return Number(byAlt.docs[0].id);
    }

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Required drink image file not found on disk: ${sourcePath}`);
    }

    const buffer = fs.readFileSync(sourcePath);
    const ext = path.extname(filename).toLowerCase();
    const mimetype = ext === '.png' ? 'image/png' : 'image/jpeg';

    const created = await payload.create({
      collection: 'media',
      data: { alt: altText },
      file: {
        data: buffer,
        name: filename,
        mimetype,
        size: buffer.length,
      },
    });
    return Number(created.id);
  }

  const chocolateCookieImgId = await resolveDrinkMedia(
    'Coffee Bay Chocolate Cookie Frappé',
    'Coffee Bay Chocolate Cookie Frappé.png',
    DRINK_IMAGE_FILES.chocolateCookieFrappe,
  );
  const caramelPeanutImgId = await resolveDrinkMedia(
    'Caramel Peanut Butter Coffee Bay Frappe',
    'Caramel Peanut Butter Coffee Bay Frappe.png',
    DRINK_IMAGE_FILES.caramelPeanutFrappe,
  );
  const espressoImgId = await resolveDrinkMedia(
    'Coffee Bay Signature Espresso',
    'COFFEE BAY Espresso Cup Cutout.png',
    DRINK_IMAGE_FILES.espressoCup,
  );
  const flatWhiteImgId = await resolveDrinkMedia(
    'Coffee Bay Flat White with Latte Art',
    'Coffee Bay Flat White with Latte Art.png',
    DRINK_IMAGE_FILES.flatWhite,
  );
  const cappuccinoImgId = await resolveDrinkMedia(
    'Coffee Bay Cappuccino',
    'Coffee Bay Latte Art Cup.png',
    DRINK_IMAGE_FILES.cappuccino,
  );

  console.log('  ✓ Resolved all 5 official studio PNG images in Media collection:', {
    chocolateCookieImgId,
    caramelPeanutImgId,
    espressoImgId,
    flatWhiteImgId,
    cappuccinoImgId,
  });

  // --------------------------------------------------------------------------
  // 4. REPLACE OLD DRINKS WITH THE 5 OFFICIAL ENGLISH DRINKS (INCLUDING CAPPUCCINO)
  // --------------------------------------------------------------------------
  console.log('\n🥤 [4/6] Resetting & seeding the 5 official English drinks in Payload...');

  // Since drink_entitlements is now empty, we can cleanly remove obsolete drinks and keep/update Cappuccino + the 4 requested drinks
  const existingCappuccino = await payload.find({
    collection: 'drinks',
    where: { name: { equals: 'Cappuccino' } },
    limit: 1,
  });
  const cappuccinoIdToKeep = existingCappuccino.docs[0]?.id
    ? Number(existingCappuccino.docs[0].id)
    : null;

  if (cappuccinoIdToKeep !== null) {
    await db.execute(
      sql`DELETE FROM drinks WHERE id <> ${cappuccinoIdToKeep}`,
    );
  } else {
    await db.execute(sql`DELETE FROM drinks`);
  }

  const officialDrinks = [
    {
      name: 'Cappuccino',
      category: hotCategory.id,
      image: cappuccinoImgId,
      description:
        'Rich double espresso balanced with steamed milk and a thick, velvety layer of airy microfoam.',
      active: true,
    },
    {
      name: 'Flat White',
      category: hotCategory.id,
      image: flatWhiteImgId,
      description:
        'Smooth double-shot Arabica espresso poured with silky steamed microfoam and signature rosette latte art.',
      active: true,
    },
    {
      name: 'Signature Espresso',
      category: hotCategory.id,
      image: espressoImgId,
      description:
        'Bold 100% Arabica espresso extracted with a rich golden crema and a deep, aromatic finish.',
      active: true,
    },
    {
      name: 'Chocolate Cookie Frappé',
      category: coldCategory.id,
      image: chocolateCookieImgId,
      description:
        'Ice-blended chocolate frappé topped with whipped cream, rich chocolate drizzle, and crunchy cookie crumbles.',
      active: true,
    },
    {
      name: 'Caramel Peanut Butter Frappé',
      category: coldCategory.id,
      image: caramelPeanutImgId,
      description:
        'Creamy peanut butter and coffee frappé crowned with whipped cream, golden caramel drizzle, and roasted peanuts.',
      active: true,
    },
  ];

  const seededDrinks: { id: number; name: string }[] = [];
  for (const item of officialDrinks) {
    const existing = await payload.find({
      collection: 'drinks',
      where: { name: { equals: item.name } },
      limit: 1,
    });

    if (existing.docs.length > 0) {
      const updated = await payload.update({
        collection: 'drinks',
        id: existing.docs[0].id,
        data: item,
      });
      seededDrinks.push({ id: Number(updated.id), name: updated.name });
      console.log(`  ✓ Updated Drink: ${updated.name} (ID: ${updated.id})`);
    } else {
      const created = await payload.create({
        collection: 'drinks',
        data: item,
      });
      seededDrinks.push({ id: Number(created.id), name: created.name });
      console.log(`  ✓ Created Drink: ${created.name} (ID: ${created.id})`);
    }
  }

  // --------------------------------------------------------------------------
  // 5. UPDATE DRINK CAMPAIGN (Cairo Flagship Opening - Clean English Metadata)
  // --------------------------------------------------------------------------
  console.log('\n🎉 [5/6] Updating Cairo Opening Campaign in Payload...');

  const campaignSlug = 'cairo-opening';
  const now = new Date();
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(now.getDate() + 30);

  const existingCampaign = await payload.find({
    collection: 'drink-campaigns',
    where: { slug: { equals: campaignSlug } },
    limit: 1,
  });

  const campaignPayload = {
    title: 'Cairo Flagship Opening',
    slug: campaignSlug,
    description:
      'Celebrate the grand opening of Coffee Bay in New Cairo! Verify your phone number and claim your complimentary handcrafted beverage.',
    allowed_categories: [hotCategory.id, coldCategory.id],
    allowed_branches: [],
    start_date: now.toISOString(),
    end_date: thirtyDaysLater.toISOString(),
    max_claims: 1000,
    total_claimed: 0,
    active: true,
    banner_image: chocolateCookieImgId,
    max_claims_per_phone: 1,
    allow_repeat_mode: 'NEVER' as const,
  };

  let cairoCampaign: { id: number; title: string; slug: string };
  if (existingCampaign.docs.length > 0) {
    cairoCampaign = await payload.update({
      collection: 'drink-campaigns',
      id: existingCampaign.docs[0].id,
      data: campaignPayload,
    });
    console.log(`  ✓ Updated Campaign: ID = ${cairoCampaign.id} (${cairoCampaign.title})`);
  } else {
    cairoCampaign = await payload.create({
      collection: 'drink-campaigns',
      data: campaignPayload,
    });
    console.log(`  ✓ Created Campaign: ID = ${cairoCampaign.id} (${cairoCampaign.title})`);
  }

  // --------------------------------------------------------------------------
  // 6. ENSURE ADMIN CASHIER ASSIGNMENT & VERIFY LEGACY ISOLATION
  // --------------------------------------------------------------------------
  console.log('\n👨‍💼 [6/6] Verifying Cashier Assignment & Database Integrity...');

  let adminUser = await payload.find({
    collection: 'users',
    where: { email: { equals: 'admin@coffeebay.com' } },
    limit: 1,
  });

  if (adminUser.docs.length === 0) {
    adminUser = await payload.find({
      collection: 'users',
      where: { role: { equals: 'ADMIN' } },
      limit: 1,
    });
  }

  if (adminUser.docs.length > 0) {
    const adminId = adminUser.docs[0].id;
    const existingAssignment = await payload.find({
      collection: 'drink-cashier-assignments',
      where: {
        and: [
          { user: { equals: adminId } },
          { branch: { equals: cairoBranch.id } },
        ],
      },
      limit: 1,
    });

    if (existingAssignment.docs.length === 0) {
      await payload.create({
        collection: 'drink-cashier-assignments',
        data: {
          user: adminId,
          branch: cairoBranch.id,
          active: true,
        },
      });
      console.log(`  ✓ Assigned ${adminUser.docs[0].email} to Cairo Flagship branch.`);
    } else {
      console.log(`  ✓ ${adminUser.docs[0].email} is already assigned to Cairo Flagship branch.`);
    }
  }

  const legacyAfter = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM codes) AS codes_count,
      (SELECT COUNT(*)::int FROM participants) AS participants_count,
      (SELECT COUNT(*)::int FROM entries) AS entries_count,
      (SELECT COUNT(*)::int FROM prize_claims) AS claims_count,
      (SELECT COUNT(*)::int FROM drink_entitlements) AS drink_entitlements_count,
      (SELECT COUNT(*)::int FROM drink_otp_challenges) AS drink_otp_challenges_count,
      (SELECT COUNT(*)::int FROM drinks) AS drinks_count
  `);
  console.log('  ✓ Database state after seed:', JSON.stringify(legacyAfter.rows[0]));

  const newVersion = bumpDrinkRewardsCacheVersion();
  console.log(`  ✓ Bumped Drink Rewards cross-worker cache version stamp to: ${newVersion}`);

  console.log('\n======================================================');
  console.log('✅  DRINK REWARDS CLEAN SEED COMPLETED SUCCESSFULLY!');
  console.log('------------------------------------------------------');
  console.log('🍹 Active Drinks in Payload CMS & PostgreSQL:');
  for (const d of seededDrinks) {
    console.log(`   - [${d.id}] ${d.name}`);
  }
  console.log('======================================================\n');

  process.exit(0);
}

seedDrinkRewards().catch((err) => {
  console.error('\n❌ Error running seed-drink-rewards:', err);
  process.exit(1);
});
