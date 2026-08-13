import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import path from "path";
import { fileURLToPath } from "url";

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
import { Settings } from "./globals/Settings";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const dbAdapter = postgresAdapter({
  pool: {
    connectionString: process.env.DATABASE_URI!,
  },
  push: false,
});

export default buildConfig({
  admin: {
    user: "users",
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
  ],
  globals: [Settings],
  editor: lexicalEditor({}),
  secret: process.env.PAYLOAD_SECRET!,
  db: dbAdapter,
  plugins: [],
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
});
