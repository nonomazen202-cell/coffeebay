/**
 * SMS Misr Plain-Text Template Builders
 *
 * Pure formatting functions converting NotificationPayloads into clean GSM
 * plain-text SMS messages without WhatsApp markdown formatting (*, _, `).
 *
 * Zero HTTP, network, or provider interface dependencies.
 */

import type { NotificationPayload } from "../../notification-provider";

const ARABIC_COMMON_NAMES: Record<string, string> = {
  حمزة: "Hamza",
  حمزه: "Hamza",
  محمد: "Mohamed",
  محمود: "Mahmoud",
  أحمد: "Ahmed",
  احمد: "Ahmed",
  علي: "Ali",
  حسن: "Hassan",
  حسين: "Hussein",
  إبراهيم: "Ibrahim",
  ابراهيم: "Ibrahim",
  خالد: "Khaled",
  عمر: "Omar",
  عمرو: "Amr",
  كريم: "Karim",
  طارق: "Tarek",
  يوسف: "Youssef",
  مصطفى: "Mostafa",
  مصطفي: "Mostafa",
  سارة: "Sara",
  ساره: "Sara",
  مريم: "Mariam",
  نور: "Nour",
  آية: "Aya",
  ايه: "Aya",
  فاطمة: "Fatma",
  منى: "Mona",
  عبدالله: "Abdallah",
  "عبد الله": "Abdallah",
  عبدالرحمن: "Abdelrahman",
  "عبد الرحمن": "Abdelrahman",
  عادل: "Adel",
  وائل: "Wael",
  سامح: "Sameh",
  هاني: "Hany",
  ماجد: "Maged",
  مي: "Mai",
  هبة: "Heba",
  رانيا: "Rania",
  دينا: "Dina",
  ياسمين: "Yasmin",
  شريف: "Sherif",
  حسام: "Hossam",
  إسلام: "Islam",
  اسلام: "Islam",
  وليد: "Walid",
  ياسر: "Yasser",
  بلال: "Belal",
  زياد: "Ziad",
  سيف: "Seif",
  مروان: "Marwan",
  يحيى: "Yehia",
  يحيي: "Yehia",
  نادين: "Nadine",
  ليلى: "Laila",
  ليلي: "Laila",
  سلمى: "Salma",
  سلمي: "Salma",
  فريدة: "Farida",
  هنا: "Hana",
  ملك: "Malak",
  جنى: "Jana",
  جني: "Jana",
  ندى: "Nada",
  ندي: "Nada",
};

/**
 * Transliterates or maps common Arabic first names into clean Latin names
 * so that SMS Misr sends the message in English GSM-7 encoding (160 chars/segment)
 * instead of falling back to UCS-2 Unicode (70 chars/segment).
 */
function toLatinFirstName(rawName?: string): string {
  if (!rawName) return "Guest";
  const trimmed = rawName.trim();
  if (!trimmed) return "Guest";

  // If already Latin letters, take the first name
  if (/^[a-zA-Z\s.'-]+$/.test(trimmed)) {
    return trimmed.split(/\s+/)[0];
  }

  const firstWord = trimmed.split(/\s+/)[0];
  if (ARABIC_COMMON_NAMES[firstWord]) {
    return ARABIC_COMMON_NAMES[firstWord];
  }

  const arMap: Record<string, string> = {
    ا: "A",
    أ: "A",
    إ: "E",
    آ: "A",
    ء: "A",
    ب: "B",
    ت: "T",
    ث: "Th",
    ج: "G",
    ح: "H",
    خ: "Kh",
    د: "D",
    ذ: "Z",
    ر: "R",
    ز: "Z",
    س: "S",
    ش: "Sh",
    ص: "S",
    ض: "D",
    ط: "T",
    ظ: "Z",
    ع: "A",
    غ: "Gh",
    ف: "F",
    ق: "Q",
    ك: "K",
    ل: "L",
    م: "M",
    ن: "N",
    ه: "H",
    و: "W",
    ي: "Y",
    ى: "A",
    ة: "H",
    ئ: "Y",
    ؤ: "O",
  };

  let result = "";
  for (const ch of firstWord) {
    result += arMap[ch] || "";
  }
  return result || "Guest";
}

/**
 * Safely extracts a clean GSM-7 compatible first name in UPPERCASE.
 * Returns null if the name cannot be cleanly mapped or contains non-GSM characters,
 * ensuring the message falls back safely rather than producing garbled transliterations.
 */
function getGsm7CompatibleFirstName(rawName?: string): string | null {
  if (!rawName) return null;
  const trimmed = rawName.trim();
  if (!trimmed) return null;

  // 1. If basic Latin letters, take first name
  if (/^[a-zA-Z\s.'-]+$/.test(trimmed)) {
    const firstWord = trimmed.split(/\s+/)[0].replace(/[^a-zA-Z]/g, "");
    const lower = firstWord.toLowerCase();
    if (lower === "guest" || lower === "customer") {
      return null;
    }
    if (firstWord.length >= 2 && firstWord.length <= 15) {
      return firstWord.toUpperCase();
    }
  }

  // 2. Check dictionary of common Arabic names
  const firstWord = trimmed.split(/\s+/)[0];
  if (ARABIC_COMMON_NAMES[firstWord]) {
    return ARABIC_COMMON_NAMES[firstWord].toUpperCase();
  }

  return null;
}

/**
 * Removes diacritics/accents (e.g. é -> e) and strips non-GSM characters
 * to strictly preserve standard English GSM-7 alphabet.
 */
function cleanGsmString(str?: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents (é -> e, è -> e)
    .replace(/[^a-zA-Z0-9\s.,!?:;'\-()]/g, "") // keep clean ASCII/GSM-7 chars
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Clean and shorten branch names to keep the SMS concise and in standard English
 * (e.g. "Cairo Flagship - New Cairo" -> "Cairo", "فرع المعادي" -> "Maadi").
 */
function cleanBranchName(rawBranch?: string): string {
  if (!rawBranch) return "";
  const trimmed = rawBranch.trim();
  if (!trimmed) return "";

  const arBranchMap: Record<string, string> = {
    "القاهرة": "Cairo",
    "فرع القاهرة": "Cairo",
    "المعادي": "Maadi",
    "فرع المعادي": "Maadi",
    "التجمع": "New Cairo",
    "فرع التجمع": "New Cairo",
    "القاهرة الجديدة": "New Cairo",
    "مدينتي": "Madinaty",
    "فرع مدينتي": "Madinaty",
    "الشيخ زايد": "Zayed",
    "فرع الشيخ زايد": "Zayed",
    "زايد": "Zayed",
    "أكتوبر": "October",
    "فرع أكتوبر": "October",
    "6 أكتوبر": "October",
    "فرع 6 أكتوبر": "October",
    "الدقي": "Dokki",
    "فرع الدقي": "Dokki",
    "المهندسين": "Mohandessin",
    "فرع المهندسين": "Mohandessin",
    "مدينة نصر": "Nasr City",
    "فرع مدينة نصر": "Nasr City",
    "مصر الجديدة": "Heliopolis",
    "فرع مصر الجديدة": "Heliopolis",
    "الإسكندرية": "Alexandria",
    "الاسكندرية": "Alexandria",
    "فرع الإسكندرية": "Alexandria",
    "سموحة": "Smouha",
    "الرحاب": "Rehab",
    "الشروق": "Shorouk",
  };

  for (const [ar, en] of Object.entries(arBranchMap)) {
    if (trimmed.includes(ar)) return en;
  }

  // If in English, strip "Branch", "Flagship", "Store", and location details after "-"
  let en = trimmed.split(/[-–—]/)[0].trim();
  en = en.replace(/\b(flagship|branch|store|cafe|shop|location)\b/gi, "").trim();
  en = en.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  const words = en.split(/\s+/).slice(0, 2).join(" ");
  return words || "";
}

export class SmsMisrTemplateBuilder {
  /**
   * Builds clean plain-text SMS from NotificationPayload.
   */
  static build(payload: NotificationPayload): string {
    switch (payload.type) {
      case "verification": {
        const code = payload.variables.code;
        return `CoffeeBay verification code is: ${code}. Valid for 5 minutes. Do not share this code with anyone.`;
      }

      case "winner-notification": {
        const fullName =
          payload.variables.participantName?.trim() || "Customer";
        const firstName = toLatinFirstName(fullName).toUpperCase();
        const prize = cleanGsmString(payload.variables.prizeName || "Prize").toUpperCase();
        const ticket = payload.variables.verificationCode || "";

        return `CoffeeBay: Congratulations ${firstName}! You won ${prize}. Ticket: ${ticket}. Show this SMS at any CoffeeBay branch.`;
      }

      case "drink-reward-otp": {
        const code = payload.variables.code;
        return `CoffeeBay: Your drink verification code is: ${code}. Valid for 5 minutes. Do not share this code.`;
      }

      case "drink-reward-voucher": {
        const voucher = cleanGsmString(payload.variables.voucherCode) || "";
        const rawBranch = payload.variables.branchName?.trim();
        const branch = cleanBranchName(rawBranch);
        const branchClause = branch ? `Redeem at ${branch} branch.` : "Redeem at any branch.";

        const candidateName = getGsm7CompatibleFirstName(payload.variables.customerName);
        const baseMessage = `CoffeeBay: FREE DRINK READY - CODE: ${voucher} - ${branchClause} Enjoy!`;

        if (candidateName) {
          const personalizedMessage = `CoffeeBay: ${candidateName} - FREE DRINK READY - CODE: ${voucher} - ${branchClause} Enjoy!`;
          if (personalizedMessage.length <= 160) {
            return personalizedMessage;
          }
        }

        return baseMessage;
      }

      case "admin-alert":
      case "drink-reward-admin-alert": {
        // Admin alerts are delivered via SMTP Email
        return "";
      }

      default: {
        return "";
      }
    }
  }
}
