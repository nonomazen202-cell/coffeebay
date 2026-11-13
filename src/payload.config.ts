import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

import { AdminUsers } from "./collections/AdminUsers";
import { Prizes } from "./collections/Prizes";
import { Codes } from "./collections/Codes";
import { Participants } from "./collections/Participants";
import { Entries } from "./collections/Entries";
import { PrizeClaims } from "./collections/PrizeClaims";
import { Media } from "./collections/Media";
import { Notifications } from "./collections/Notifications";
import { NotificationAudit } from "./collections/NotificationAudit";
import { OTPVerifications } from "./collections/OTPVerifications";
import {
  DrinkCategories,
  Drinks,
  Branches,
  DrinkCampaigns,
  DrinkEntitlements,
  DrinkCashierAssignments,
  DrinkOtpChallenges,
} from "./collections/drink-rewards";
import { Settings } from "./globals/Settings";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

import {
  executePostCommitInvalidations,
  discardPostCommitInvalidations,
} from "./lib/cache/drink-rewards-cache";

const isBackgroundWorker = process.env.DISABLE_NOTIFICATION_WORKER === "true";

const baseDbAdapter = postgresAdapter({
  pool: {
    connectionString: process.env.DATABASE_URI!,
    // Size pool cleanly for 50+ concurrent admins + customer traffic while
    // keeping background worker footprint minimal (total <= 30 connections).
    max: isBackgroundWorker ? 5 : Number(process.env.PG_POOL_MAX) || 25,
    // Prevent intermediate NAT/stateful firewalls between web & remote DB
    // from silently blackholing idle TCP sockets (root cause of silent login hang / NetworkError).
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
    allowExitOnIdle: false,
  },
  push: false,
});

const dbAdapter: typeof baseDbAdapter = {
  ...baseDbAdapter,
  init: (args) => {
    const adapter = baseDbAdapter.init(args);
    const originalCommit = adapter.commitTransaction;
    const originalRollback = adapter.rollbackTransaction;

    if (typeof originalCommit === "function") {
      adapter.commitTransaction = async (id) => {
        let resolvedId: string | number | undefined;
        try {
          resolvedId = await id;
        } catch (err) {
          console.warn("[Cache] Failed to resolve transaction ID in commit:", err);
        }

        try {
          await originalCommit.call(adapter, id);
        } catch (commitErr) {
          // Ambiguous / Failed Commit: execute fail-safe invalidation immediately
          if (resolvedId !== undefined && resolvedId !== null) {
            try {
              executePostCommitInvalidations(resolvedId);
            } catch (cacheErr) {
              console.warn("[Cache] Fail-safe invalidation error on commit failure:", cacheErr);
            }
          }
          throw commitErr;
        }

        // Successful Commit: flush queued invalidations
        if (resolvedId !== undefined && resolvedId !== null) {
          try {
            executePostCommitInvalidations(resolvedId);
          } catch (err) {
            console.warn("[Cache] Post-commit invalidation error:", err);
          }
        }
      };
    }

    if (typeof originalRollback === "function") {
      adapter.rollbackTransaction = async (id) => {
        let resolvedId: string | number | undefined;
        try {
          resolvedId = await id;
        } catch (err) {
          console.warn("[Cache] Failed to resolve transaction ID in rollback:", err);
        }

        let rollbackFailed = false;
        let rollbackError: unknown = null;

        try {
          await originalRollback.call(adapter, id);
        } catch (err) {
          rollbackFailed = true;
          rollbackError = err;
          console.error("[Cache] PostgreSQL rollbackTransaction failed (indeterminate state):", err);
        }

        if (rollbackFailed) {
          // Indeterminate State: Rollback threw error -> Fail-safe invalidate affected tags!
          if (resolvedId !== undefined && resolvedId !== null) {
            try {
              executePostCommitInvalidations(resolvedId);
            } catch (cacheErr) {
              console.warn("[Cache] Fail-safe invalidation error after rollback failure:", cacheErr);
            }
          }
          throw rollbackError;
        }

        // Confirmed clean Rollback: discard queued invalidations and free memory
        if (resolvedId !== undefined && resolvedId !== null) {
          discardPostCommitInvalidations(resolvedId);
        }
      };
    }

    return adapter;
  },
};

export default buildConfig({
  admin: {
    user: "users",
    autoRefresh: true,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      Nav: "@/components/admin/CustomNav#CustomNav",
      graphics: {
        Logo: "@/components/admin/CustomLogo#CustomLogo",
        Icon: "@/components/admin/CustomIcon#CustomIcon",
      },
      views: {
        dashboard: {
          Component: "@/components/admin/CustomDashboard#CustomDashboard",
        },
      },
    },
  },
  collections: [
    AdminUsers,
    Prizes,
    Codes,
    Participants,
    Entries,
    PrizeClaims,
    Media,
    Notifications,
    NotificationAudit,
    OTPVerifications,
    // ─── Drink Rewards Module (Independent Bounded Context) ───
    DrinkCategories,
    Drinks,
    Branches,
    DrinkCampaigns,
    DrinkEntitlements,
    DrinkCashierAssignments,
    DrinkOtpChallenges,
  ],
  globals: [Settings],
  editor: lexicalEditor({}),
  secret: process.env.PAYLOAD_SECRET!,
  db: dbAdapter,
  sharp,
  plugins: [],
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
    autoGenerate: false,
  },
});
