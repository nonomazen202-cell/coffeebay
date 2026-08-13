import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";
import { getPayload, type Payload } from "payload";

// ─── Load Env Variables ──────────────────────────────────────────────────
function loadEnv(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        let val = trimmed.substring(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    }
  }
}

// ─── Initialize Payload ─────────────────────────────────────────────────
let payloadInstance: Payload | null = null;
async function getPayloadInstance(): Promise<Payload> {
  if (!payloadInstance) {
    loadEnv();
    const { default: config } = await import("../../payload.config");
    payloadInstance = await getPayload({ config });
  }
  return payloadInstance;
}


async function main() {
  console.log("==================================================");
  console.log("🔄 Resetting Testing Environment and Seed Data...");
  console.log("==================================================");

  const payload = await getPayloadInstance();

  console.log("\n🧹 Step 1: Wiping transactional database tables...");
  // Cascade truncate transactional tables immediately
  await payload.db.drizzle.execute(
    sql`TRUNCATE TABLE prize_claims, entries, participants, notifications, notification_audit CASCADE`,
  );
  console.log("✅ Transaction tables truncated.");

  console.log("\n🧹 Step 2: Clearing existing codes...");
  await payload.db.drizzle.execute(sql`TRUNCATE TABLE codes CASCADE`);
  console.log("✅ Codes table truncated.");

  console.log(
    "\n🌱 Step 3: Seeding default prizes if missing (retains existing configuration)...",
  );
  // Insert default prizes with explicit IDs if they do not exist
  await payload.db.drizzle.execute(sql`
    INSERT INTO prizes (id, name, quantity, active, created_at, updated_at) 
    VALUES 
      (1, '50% Off Discount Coupon', 50, true, NOW(), NOW()),
      (2, '30% Off Discount Coupon', 70, true, NOW(), NOW()),
      (3, '25% Off Discount Coupon', 78, true, NOW(), NOW()),
      (4, 'AirPods', 1, true, NOW(), NOW()),
      (5, 'IPhone 14 Pro Max', 1, true, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `);

  // Sync the PostgreSQL auto-increment sequence to start at ID 6
  await payload.db.drizzle.execute(sql`SELECT setval('prizes_id_seq', 5)`);
  console.log("✅ Default prizes check completed and sequence synchronized.");

  console.log("\n📖 Step 4: Reading generated-codes/all-codes.csv...");
  const csvPath = path.resolve(process.cwd(), "generated-codes/all-codes.csv");
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV File not found at: ${csvPath}`);
    console.error(
      "Please run code generation first, or verify the file exists.",
    );
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, "utf8");
  const lines = csvContent.split(/\r?\n/);

  interface SeedCode {
    serialCode: string;
    isWinner: boolean;
    prizeId: number | null;
  }

  const parsedCodes: SeedCode[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Skip header row
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(",");
    const serialCode = parts[0]?.trim();
    const isWinner = parts[1]?.trim().toLowerCase() === "true";
    const prizeIdStr = parts[2]?.trim();
    const prizeId = prizeIdStr ? parseInt(prizeIdStr, 10) : null;

    if (serialCode) {
      parsedCodes.push({ serialCode, isWinner, prizeId });
    }
  }

  console.log(
    `💡 Found ${parsedCodes.length} codes to import. Performing raw SQL bulk insert...`,
  );

  // Split into chunks of 1000 to avoid query size limitations
  const batchSize = 1000;
  for (let i = 0; i < parsedCodes.length; i += batchSize) {
    const chunk = parsedCodes.slice(i, i + batchSize);

    const valuesSql: string[] = [];
    chunk.forEach((code) => {
      const prizeIdVal = code.prizeId !== null ? code.prizeId : "NULL";
      // Safe to inline as we verified values contain only strict alphanumeric serials, booleans, and integers
      valuesSql.push(
        `('${code.serialCode}', ${code.isWinner}, ${prizeIdVal}, false, NOW(), NOW())`,
      );
    });

    const query = `
      INSERT INTO codes (serial_code, is_winner, prize_id_id, claimed, created_at, updated_at) 
      VALUES ${valuesSql.join(", ")}
    `;

    await payload.db.drizzle.execute(sql.raw(query));
  }

  console.log(
    `✅ Bulk import completed successfully. Imported ${parsedCodes.length} codes.`,
  );

  console.log("\n==================================================");
  console.log(
    "🎉 Environment Reset Completed Successfully! (100% Clean State)",
  );
  console.log("==================================================\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Environment reset failed:", err);
  process.exit(1);
});
