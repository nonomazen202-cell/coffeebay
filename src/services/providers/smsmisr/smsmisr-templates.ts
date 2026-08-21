/**
 * SMS Misr Plain-Text Template Builders
 *
 * Pure formatting functions converting NotificationPayloads into clean GSM
 * plain-text SMS messages without WhatsApp markdown formatting (*, _, `).
 *
 * Zero HTTP, network, or provider interface dependencies.
 */

import type { NotificationPayload } from "../../notification-provider";

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
        const firstName = fullName.split(/\s+/)[0].toUpperCase();
        const prize = (payload.variables.prizeName || "Prize").toUpperCase();
        const ticket = payload.variables.verificationCode || "";

        return `CoffeeBay: Congratulations ${firstName}! You won ${prize}. Ticket: ${ticket}. Show this SMS at any CoffeeBay branch.`;
      }

      case "admin-alert": {
        // Admin alerts are disabled on SMS Misr
        return "";
      }

      default: {
        return "";
      }
    }
  }
}
