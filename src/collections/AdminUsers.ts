import type { CollectionConfig } from "payload";
import { sql } from "drizzle-orm";
import {
  canManageUsersAccess,
  usersReadAccess,
  usersUpdateAccess,
  isSuperAdminAccess,
} from "./access";
import {
  isSuperAdmin,
  canManageUsers,
  getCanonicalRole,
} from "../lib/security/roles";

export const AdminUsers: CollectionConfig = {
  slug: "users",
  auth: true,
  timestamps: true,
  access: {
    read: usersReadAccess,
    create: canManageUsersAccess,
    update: usersUpdateAccess,
    delete: isSuperAdminAccess,
  },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "email", "role", "active_branch_display"],
    group: "System Administration / إدارة المنظومة",
    hidden: ({ user }) => !canManageUsers(user),
  },
  hooks: {
    beforeValidate: [
      async ({ data, req, operation }) => {
        if (!data) return data;
        const currentUser = req.user;
        const targetRole = data.role;

        // 1. Guard Super Admin role: only existing SUPER_ADMIN or authorized bootstrap script can create/assign SUPER_ADMIN
        if (targetRole === "SUPER_ADMIN") {
          if (!currentUser || !isSuperAdmin(currentUser)) {
            if (!req.context?.isBootstrap) {
              throw new Error(
                "لا يمكن إنشاء أو تعيين دور المدير العام (Super Admin) إلا بواسطة مدير عام مصرح له.",
              );
            }
          }
        }

        // 2. Domain Admin scoping: Domain admins manage their own domain accounts (Admin + Staff)
        if (currentUser && !isSuperAdmin(currentUser)) {
          const currentCanonical = getCanonicalRole(currentUser.role);
          if (currentCanonical === "PROMOTIONS_ADMIN") {
            if (
              targetRole &&
              targetRole !== "PROMOTIONS_ADMIN" &&
              targetRole !== "PROMOTIONS_STAFF"
            ) {
              if (
                operation === "create" ||
                (operation === "update" && targetRole !== currentUser.role)
              ) {
                throw new Error(
                  "مدير الحملات مصرح له فقط بإدارة وإنشاء حسابات نظام الحملات والعروض (Promotions).",
                );
              }
            }
          } else if (currentCanonical === "LUCKY_CUP_ADMIN") {
            if (
              targetRole &&
              targetRole !== "LUCKY_CUP_ADMIN" &&
              targetRole !== "LUCKY_CUP_STAFF"
            ) {
              if (
                operation === "create" ||
                (operation === "update" && targetRole !== currentUser.role)
              ) {
                throw new Error(
                  "مدير مسابقة الأكواب مصرح له فقط بإدارة وإنشاء حسابات نظام مسابقة أكواب الحظ (Lucky Cup).",
                );
              }
            }
          } else {
            throw new Error("غير مصرح لك بإدارة أو إنشاء المستخدمين.");
          }
        }

        return data;
      },
    ],
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        if (!data) return data;
        const targetRole = data.role;

        // Prevent demoting the last SUPER_ADMIN
        if (operation === "update" && originalDoc) {
          if (
            isSuperAdmin(originalDoc) &&
            targetRole &&
            targetRole !== "SUPER_ADMIN"
          ) {
            const superAdminsCount = await req.payload.count({
              collection: "users",
              where: { role: { equals: "SUPER_ADMIN" } },
              overrideAccess: true,
            });
            if (superAdminsCount.totalDocs <= 1) {
              throw new Error(
                "لا يمكن تخفيض صلاحيات المدير العام الأخير (SUPER_ADMIN) لضمان استمرارية النظام.",
              );
            }
          }
        }

        return data;
      },
    ],
    beforeDelete: [
      async ({ req, id }) => {
        try {
          const target = await req.payload.findByID({
            collection: "users",
            id,
            depth: 0,
            overrideAccess: true,
          });
          if (target && isSuperAdmin(target)) {
            const superAdminsCount = await req.payload.count({
              collection: "users",
              where: { role: { equals: "SUPER_ADMIN" } },
              overrideAccess: true,
            });
            if (superAdminsCount.totalDocs <= 1) {
              throw new Error(
                "لا يمكن حذف حساب المدير العام الأخير (SUPER_ADMIN) لمنع إغلاق المنظومة.",
              );
            }
          }
        } catch (err: unknown) {
          if (
            err instanceof Error &&
            err.message.includes("لا يمكن حذف حساب")
          ) {
            throw err;
          }
        }
      },
    ],
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "role",
      type: "select",
      required: true,
      admin: {
        placeholder: "اختر الدور الوظيفي... / Select a role...",
      },
      access: {
        update: ({ req: { user } }) => Boolean(user && isSuperAdmin(user)),
      },
      filterOptions: ({ req }) => {
        const currentUser = req?.user;
        if (!currentUser) return [];

        const canonical = getCanonicalRole(currentUser.role);

        // 1. If Super Admin (Developer): can assign any domain role
        if (isSuperAdmin(currentUser)) {
          return [
            {
              label: "Promotions Admin / مدير الحملات والعروض",
              value: "PROMOTIONS_ADMIN",
            },
            {
              label: "Promotions Staff (Cashier) / كاشير وصرف الفرع",
              value: "PROMOTIONS_STAFF",
            },
            {
              label: "Lucky Cup Admin / مدير مسابقة الأكواب",
              value: "LUCKY_CUP_ADMIN",
            },
            {
              label: "Lucky Cup Staff / موظف تسليم جوائز الأكواب",
              value: "LUCKY_CUP_STAFF",
            },
          ];
        }

        // 2. If Promotions Admin: can manage Promotions domain roles (Admin + Staff)
        if (canonical === "PROMOTIONS_ADMIN") {
          return [
            {
              label: "Promotions Admin / مدير الحملات والعروض",
              value: "PROMOTIONS_ADMIN",
            },
            {
              label: "Promotions Staff (Cashier) / كاشير وصرف الفرع",
              value: "PROMOTIONS_STAFF",
            },
          ];
        }

        // 3. If Lucky Cup Admin: can manage Lucky Cup domain roles (Admin + Staff)
        if (canonical === "LUCKY_CUP_ADMIN") {
          return [
            {
              label: "Lucky Cup Admin / مدير مسابقة الأكواب",
              value: "LUCKY_CUP_ADMIN",
            },
            {
              label: "Lucky Cup Staff / موظف تسليم جوائز الأكواب",
              value: "LUCKY_CUP_STAFF",
            },
          ];
        }

        return [];
      },
      options: [
        {
          label: "Promotions Admin / مدير الحملات والعروض",
          value: "PROMOTIONS_ADMIN",
        },
        {
          label: "Promotions Staff (Cashier) / كاشير وصرف الفرع",
          value: "PROMOTIONS_STAFF",
        },
        {
          label: "Lucky Cup Admin / مدير مسابقة الأكواب",
          value: "LUCKY_CUP_ADMIN",
        },
        {
          label: "Lucky Cup Staff / موظف تسليم جوائز الأكواب",
          value: "LUCKY_CUP_STAFF",
        },
        {
          label: "Super Admin / مدير عام المنظومة (كامل الصلاحيات)",
          value: "SUPER_ADMIN",
        },
      ],
    },
    {
      name: "active_branch_display",
      type: "text",
      virtual: true,
      label: "الفرع النشط الحالي للكاشير / Active Cashier Branch",
      admin: {
        readOnly: true,
        condition: (data) => data?.role === "PROMOTIONS_STAFF",
        description:
          "يتم جلب هذا الفرع تلقائياً من جدول تعيينات الفروع  (drink-cashier-assignments).",
      },
      hooks: {
        afterRead: [
          async ({ data, req }) => {
            if (!data?.id) return "غير محدد";
            // Only cashiers have branch assignments
            const role = data?.role;
            if (role !== "PROMOTIONS_STAFF") {
              return null;
            }
            if (req?.context?.skipBranchLookup) {
              return "محفوظ في التعيينات";
            }
            try {
              if (req?.payload?.db?.drizzle) {
                const res = await req.payload.db.drizzle.execute(sql`
                  SELECT b.name as branch_name
                  FROM drink_cashier_assignments a
                  JOIN branches b ON a.branch_id = b.id
                  WHERE a.user_id = ${data.id} AND a.active = true
                  ORDER BY a.assigned_at DESC, a.id DESC
                  LIMIT 1;
                `);
                if (res.rows && res.rows.length > 0) {
                  return (
                    (res.rows[0] as { branch_name: string }).branch_name ||
                    "لا يوجد فرع نشط حالياً"
                  );
                }
              }
              return "لا يوجد فرع نشط حالياً";
            } catch {
              return "لا يوجد فرع نشط حالياً";
            }
          },
        ],
      },
    },
  ],
};
