import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";
import { getPayload, type Payload } from "payload";

// ─── 1. Load Environment Variables ──────────────────────────────────────
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

// ─── 2. Initialize Payload ───────────────────────────────────────────────
let payloadInstance: Payload | null = null;
async function getPayloadInstance(): Promise<Payload> {
  if (!payloadInstance) {
    loadEnv();
    const { default: config } = await import("../payload.config");
    payloadInstance = await getPayload({ config });
  }
  return payloadInstance;
}

// ─── 3. The 120 Winning Codes Provided by Client ────────────────────────
const WINNING_CODES_RAW: string[] = [
  // Block 1 (40 codes)
  "X934-0362", "M541-5457", "K784-4830", "E489-8642", "X126-8585",
  "X151-1224", "A927-4772", "A055-0551", "Y269-7627", "R707-3859",
  "C742-2446", "Y149-2901", "R911-1984", "Y141-1465", "M693-7586",
  "J809-9173", "U516-7402", "P666-1702", "J491-5551", "E165-4817",
  "U779-7645", "W448-8651", "H735-3211", "P818-1114", "M394-5745",
  "R365-5199", "E919-8192", "G829-3875", "V590-7597", "E921-1932",
  "W831-7699", "U610-8483", "N839-4937", "K769-4405", "N925-0776",
  "Y464-0779", "D398-9286", "W228-4497", "C095-4982", "T640-3242",

  // Block 2 (40 codes)
  "W080-0125", "U780-7401", "Y341-3557", "N192-5479", "C804-4783",
  "J532-0296", "G981-7745", "D248-1701", "P476-3720", "E829-2845",
  "R910-6815", "M020-2912", "C923-0795", "X808-4990", "W384-7138",
  "V982-5607", "M763-2659", "N680-5641", "H840-4034", "E863-1587",
  "K587-9316", "X617-7910", "E947-7696", "H692-7592", "F361-8076",
  "X579-0958", "X805-4637", "V267-3615", "K772-3866", "Y891-2169",
  "K600-3946", "A752-8639", "T508-2133", "Y669-1336", "W734-3495",
  "A695-7396", "N704-2644", "C711-5987", "C951-1355", "C377-3881",

  // Block 3 (40 codes)
  "X025-5424", "W320-8362", "V951-8767", "C002-6790", "E966-6688",
  "U576-0682", "V715-7883", "Y751-1020", "H183-1026", "E109-3969",
  "Y726-9372", "E113-3672", "T667-5661", "P162-7261", "U220-7653",
  "W400-6465", "P939-6005", "J037-2958", "G383-2272", "W850-5630",
  "M578-7318", "Y241-6123", "J008-0769", "M701-0889", "C229-9863",
  "U591-4901", "H997-7057", "M835-0451", "E553-3983", "C513-8620",
  "N599-9645", "A246-7852", "R295-3966", "P610-7730", "Y617-3409",
  "E466-8606", "J452-4657", "U549-9219", "F884-0762", "J882-1848",
];

// Clean and normalize winning codes
const WINNING_CODES = Array.from(
  new Set(WINNING_CODES_RAW.map((c) => c.trim().toUpperCase()))
);

// ─── 4. The 80 Unprinted Codes To Completely Remove ────────────────────
const UNPRINTED_CODES_RAW: string[] = [
  // Block 1 (40 codes)
  "H959-0629", "U501-7323", "E017-0044", "T213-6738", "H081-4470",
  "H724-4129", "U931-0849", "U864-9961", "E619-4309", "F582-3654",
  "J295-9009", "G817-6874", "K895-4951", "D706-6817", "W786-7699",
  "N817-7832", "L345-0526", "W540-5647", "G970-0299", "X224-4126",
  "V908-0834", "N578-6645", "T513-5716", "C315-1702", "N294-5953",
  "G093-1000", "P149-9797", "A382-9158", "U433-2263", "D711-9483",
  "J011-1249", "Y915-8107", "G473-4262", "X634-3223", "E335-3668",
  "D998-3086", "G468-6583", "F990-2372", "T705-1587", "M613-3863",

  // Block 2 (40 codes)
  "V925-5676", "J696-2476", "H560-9500", "J954-2758", "C481-4660",
  "F277-2129", "Y579-7366", "F623-2095", "X185-1669", "G577-7598",
  "V301-3909", "K189-8512", "W470-9154", "Y844-9194", "T676-9489",
  "P055-7661", "W590-7360", "H621-5472", "T269-1938", "A618-7842",
  "J615-7405", "J402-2707", "N003-3046", "R259-9201", "T982-4376",
  "K961-9177", "Y890-0565", "M540-3811", "R216-6351", "J841-7125",
  "J184-0167", "H747-1821", "Y205-2989", "E434-5263", "F336-0631",
  "A072-9061", "F132-1983", "X250-7316", "N804-8897", "Y261-1460",
];

const UNPRINTED_CODES_SET = new Set(
  UNPRINTED_CODES_RAW.map((c) => c.trim().toUpperCase())
);

// ─── 5. Main Update Execution ───────────────────────────────────────────
async function main() {
  console.log("\n=======================================================");
  console.log("🏆   COFFEEBAY — CAMPAIGN PRIZES & CODES REFINEMENT   ");
  console.log("=======================================================\n");

  if (WINNING_CODES.length !== 120) {
    console.error(
      `❌ Error: Expected exactly 120 unique winning codes, but got ${WINNING_CODES.length}.`
    );
    process.exit(1);
  }

  const payload = await getPayloadInstance();

  // ── Step 1: Reset transactional logs ──────────────────────────────────
  console.log("🧹 Step 1: Resetting transactional logs (entries, claims, notifications)...");
  await payload.db.drizzle.execute(
    sql`TRUNCATE TABLE prize_claims, entries, participants, notifications, notification_audit CASCADE`
  );
  console.log("✅ Transactional tables cleared.");

  // ── Step 2: Clean and Sync Database with 3,920 Printed Codes ─────────
  console.log("\n📦 Step 2: Syncing database with exact 3,920 printed codes from all-codes.csv...");
  const csvPath = path.resolve(process.cwd(), "generated-codes/all-codes.csv");
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV File not found at: ${csvPath}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, "utf8");
  const lines = csvContent.split(/\r?\n/);
  const printedCodes: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const serial = line.split(",")[0]?.trim().toUpperCase();
    if (serial && !UNPRINTED_CODES_SET.has(serial)) {
      printedCodes.push(serial);
    }
  }

  // Wiping codes table and re-inserting exact 3920 printed codes cleanly
  await payload.db.drizzle.execute(sql`TRUNCATE TABLE codes CASCADE`);

  const batchSize = 1000;
  for (let i = 0; i < printedCodes.length; i += batchSize) {
    const chunk = printedCodes.slice(i, i + batchSize);
    const valuesSql = chunk.map(
      (code) => `('${code}', false, NULL, false, NOW(), NOW())`
    );
    await payload.db.drizzle.execute(
      sql.raw(`
        INSERT INTO codes (serial_code, is_winner, prize_id_id, claimed, created_at, updated_at) 
        VALUES ${valuesSql.join(", ")}
        ON CONFLICT (serial_code) DO NOTHING
      `)
    );
  }

  const newCountRes = await payload.db.drizzle.execute(
    sql`SELECT COUNT(*)::int as total FROM codes`
  );
  let totalCodes = (newCountRes.rows[0] as { total: number })?.total || 0;
  console.log(`✅ Database synced with exactly ${totalCodes.toLocaleString()} printed codes.`);

  // ── Step 4: Configure 4 Clean GSM Prizes ──────────────────────────────
  console.log("\n🎁 Step 4: Setting up 4 Clean GSM-Friendly Prizes in database...");
  
  // Unlink prizes from codes first to prevent any FK lock
  await payload.db.drizzle.execute(
    sql`UPDATE codes SET prize_id_id = NULL, is_winner = false, claimed = false, claimed_at = NULL, updated_at = NOW()`
  );

  // Delete any old unused prizes beyond ID 4
  await payload.db.drizzle.execute(sql`DELETE FROM prizes WHERE id > 4`);

  // Upsert the 4 exact clean prizes
  await payload.db.drizzle.execute(sql`
    INSERT INTO prizes (id, name, quantity, description, active, created_at, updated_at)
    VALUES
      (1, 'JBL Speaker', 1, 'JBL Speaker Grand Prize', true, NOW(), NOW()),
      (2, 'Kenz Card 2K EGP Gift Voucher', 2, '2K EGP Gift Voucher Card from Kenz (Redeemable at: Zara, Bershka, Stradivarius, Oysho, Kiko Milano, Pull & Bear, Massimo Dutti, Sunglass Hut)', true, NOW(), NOW()),
      (3, 'Mother Naked Hot Girl Bundle', 3, 'Hot Girl Essentials Bundle package from Mother Naked', true, NOW(), NOW()),
      (4, 'Spin The Wheel at the branch', 114, 'Spin the wheel at the branch to get instant surprises', true, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      quantity = EXCLUDED.quantity,
      description = EXCLUDED.description,
      active = EXCLUDED.active,
      updated_at = NOW()
  `);

  await payload.db.drizzle.execute(sql`SELECT setval('prizes_id_seq', 4)`);
  console.log("✅ 4 Clean Prizes configured successfully:");
  console.log("   - [ID: 1] JBL Speaker (Quantity: 1)");
  console.log("   - [ID: 2] Kenz Card 2K EGP Gift Voucher (Quantity: 2)");
  console.log("   - [ID: 3] Mother Naked Hot Girl Bundle (Quantity: 3)");
  console.log("   - [ID: 4] Spin The Wheel at the branch (Quantity: 114)");

  // ── Step 5: Assign Prizes to the 120 Specific Codes ───────────────────
  console.log("\n🎯 Step 5: Assigning prizes to the 120 winning codes...");

  interface WinnerAssignment {
    serialCode: string;
    prizeId: number;
    prizeName: string;
  }

  const assignments: WinnerAssignment[] = [];

  // 1 JBL
  assignments.push({
    serialCode: WINNING_CODES[0],
    prizeId: 1,
    prizeName: "JBL Speaker",
  });

  // 2 Kenz Card
  assignments.push({
    serialCode: WINNING_CODES[1],
    prizeId: 2,
    prizeName: "Kenz Card 2K EGP Gift Voucher",
  });
  assignments.push({
    serialCode: WINNING_CODES[2],
    prizeId: 2,
    prizeName: "Kenz Card 2K EGP Gift Voucher",
  });

  // 3 Mother Naked Bundle
  assignments.push({
    serialCode: WINNING_CODES[3],
    prizeId: 3,
    prizeName: "Mother Naked Hot Girl Bundle",
  });
  assignments.push({
    serialCode: WINNING_CODES[4],
    prizeId: 3,
    prizeName: "Mother Naked Hot Girl Bundle",
  });
  assignments.push({
    serialCode: WINNING_CODES[5],
    prizeId: 3,
    prizeName: "Mother Naked Hot Girl Bundle",
  });

  // Remaining 114 -> Spin The Wheel
  for (let i = 6; i < 120; i++) {
    assignments.push({
      serialCode: WINNING_CODES[i],
      prizeId: 4,
      prizeName: "Spin The Wheel at the branch",
    });
  }

  // Update winning codes in database
  let updatedCount = 0;
  for (const item of assignments) {
    const updateRes = await payload.db.drizzle.execute(sql`
      UPDATE codes 
      SET is_winner = true, prize_id_id = ${item.prizeId}, claimed = false, claimed_at = NULL, updated_at = NOW()
      WHERE serial_code = ${item.serialCode}
    `);
    if (updateRes.rowCount && updateRes.rowCount > 0) {
      updatedCount += updateRes.rowCount;
    } else {
      console.warn(`⚠️ Warning: Winning code '${item.serialCode}' was not found in the 'codes' table!`);
    }
  }

  console.log(`✅ Successfully updated ${updatedCount} / 120 winning codes in database.`);

  // ── Step 6: Verification & Sanity Checks ──────────────────────────────
  console.log("\n🧪 Step 6: Performing Database Sanity Checks...");

  const winnersCountRes = await payload.db.drizzle.execute(
    sql`SELECT COUNT(*)::int as count FROM codes WHERE is_winner = true`
  );
  const dbWinners = (winnersCountRes.rows[0] as { count: number })?.count || 0;

  const losersCountRes = await payload.db.drizzle.execute(
    sql`SELECT COUNT(*)::int as count FROM codes WHERE is_winner = false`
  );
  const dbLosers = (losersCountRes.rows[0] as { count: number })?.count || 0;

  console.log(`   - Total Printed Database Winners: ${dbWinners} / 120`);
  console.log(`   - Total Printed Database Losers:  ${dbLosers.toLocaleString()} / ${(totalCodes - 120).toLocaleString()}`);
  console.log(`   - Total Active Database Codes:   ${(dbWinners + dbLosers).toLocaleString()}`);

  const prizeCountsRes = await payload.db.drizzle.execute(sql`
    SELECT p.name, p.id, COUNT(c.id)::int as assigned_count
    FROM prizes p
    LEFT JOIN codes c ON c.prize_id_id = p.id AND c.is_winner = true
    GROUP BY p.id, p.name
    ORDER BY p.id ASC
  `);

  console.log("\n📊 Prize Allocation Verification:");
  console.log("┌────┬────────────────────────────────────────────┬──────────┐");
  console.log("│ ID │ Prize Name                                 │ Assigned │");
  console.log("├────┼────────────────────────────────────────────┼──────────┤");
  const rows = prizeCountsRes.rows as unknown as Array<{ id: number; name: string; assigned_count: number }>;
  rows.forEach((r) => {
    const idStr = String(r.id).padEnd(2);
    const nameStr = r.name.padEnd(42);
    const countStr = String(r.assigned_count).padStart(8);
    console.log(`│ ${idStr} │ ${nameStr} │ ${countStr} │`);
  });
  console.log("└────┴────────────────────────────────────────────┴──────────┘");

  // ── Step 7: Export Clean Winning Audit Files & Sync all-codes.csv ─────
  const outDir = path.resolve(process.cwd(), "generated-codes");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // 1. Audit CSV
  const csvLines = [
    "Index,SerialCode,PrizeId,PrizeName",
    ...assignments.map(
      (a, idx) => `${idx + 1},${a.serialCode},${a.prizeId},"${a.prizeName}"`
    ),
  ];
  const auditCsvPath = path.join(outDir, "winners-120-audit.csv");
  fs.writeFileSync(auditCsvPath, csvLines.join("\n"), "utf8");

  // 2. Audit TXT Report
  const txtLines: string[] = [
    "============================================================",
    "       COFFEEBAY LUCKY CUP — 120 WINNING CODES REPORT       ",
    "============================================================",
    `Generated on: ${new Date().toLocaleString()}`,
    `Total Winners: ${assignments.length}`,
    "",
    "🏆 1. JBL Speaker (Qty: 1):",
    `   - ${assignments[0].serialCode}`,
    "",
    "🏆 2. Kenz Card 2K EGP Gift Voucher (Qty: 2):",
    `   - ${assignments[1].serialCode}`,
    `   - ${assignments[2].serialCode}`,
    "",
    "🏆 3. Mother Naked Hot Girl Bundle (Qty: 3):",
    `   - ${assignments[3].serialCode}`,
    `   - ${assignments[4].serialCode}`,
    `   - ${assignments[5].serialCode}`,
    "",
    `🏆 4. Spin The Wheel at the branch (Qty: 114):`,
    ...assignments.slice(6).map((a, idx) => `   ${String(idx + 1).padStart(3, " ")}. ${a.serialCode}`),
    "",
    "============================================================",
  ];
  const txtPath = path.join(outDir, "winners-120-audit.txt");
  fs.writeFileSync(txtPath, txtLines.join("\n"), "utf8");

  // 3. Update all-codes.csv to reflect only the actual 3,920 printed codes in DB
  const allCodesRes = await payload.db.drizzle.execute(
    sql`SELECT serial_code, is_winner, prize_id_id FROM codes ORDER BY id ASC`
  );
  const allDbRows = allCodesRes.rows as unknown as Array<{
    serial_code: string;
    is_winner: boolean;
    prize_id_id: number | null;
  }>;

  const newAllCodesCsv = [
    "serialCode,isWinner,prizeId",
    ...allDbRows.map(
      (r) => `${r.serial_code},${r.is_winner},${r.prize_id_id ?? ""}`
    ),
  ].join("\n");
  fs.writeFileSync(path.join(outDir, "all-codes.csv"), newAllCodesCsv, "utf8");

  console.log(`\n📁 Clean Files Updated:`);
  console.log(`   - CSV Audit: generated-codes/winners-120-audit.csv`);
  console.log(`   - TXT Report: generated-codes/winners-120-audit.txt`);
  console.log(`   - Clean Synced Master CSV (3,920 printed codes): generated-codes/all-codes.csv`);

  console.log("\n=======================================================");
  console.log("🎉   UNPRINTED CODES REMOVED & CAMPAIGN SYNCED CLEANLY  ");
  console.log("=======================================================\n");

  process.exit(0);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("❌ Process failed:", msg);
  process.exit(1);
});
