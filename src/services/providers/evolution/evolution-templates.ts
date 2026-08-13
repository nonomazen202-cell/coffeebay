import type { NotificationPayload } from "../../notification-provider";

export class EvolutionTemplateBuilder {
  /**
   * Renders a NotificationPayload into a plain-text WhatsApp message.
   */
  static build(payload: NotificationPayload): string {
    switch (payload.type) {
      case "winner-notification":
        return [
          "*✦ COFFEEBAY REWARDS ✦*",
          "",
          `🎉 Congratulations, *${payload.variables.participantName}*!`,
          `Our CoffeeBay Lucky Cup code \`${payload.variables.serialCode}\` is a winner!`,
          "",
          "",
          `*◆ Awarded Prize:* *${payload.variables.prizeName}*`,
          `*◆ Ticket Key:* \`${payload.variables.verificationCode}\``,
          "",
          "--------------------------------",
          "*REDEMPTION PROTOCOL*",
          "--------------------------------",
          "1. Visit your nearest CoffeeBay branch.",
          "2. Present this message to the cashier.",
          "3. Your prize will be processed and delivered.",
          "",
          "_◆ CoffeeBay Lucky Cup System_",
        ].join("\n");

      case "admin-alert":
        return [
          "*✦ COFFEEBAY OPERATIONS ✦*",
          "",
          "A new prize redemption has been logged.",
          "",
          `*◆ Participant:* *${payload.variables.participantName}*`,
          `*◆ Contact:* ${payload.variables.participantPhone}`,
          `*◆ Prize:* *${payload.variables.prizeName}*`,
          `*◆ Prize Code:* \`${payload.variables.serialCode}\``,
          "",
          "--------------------------------",
          "_◆ CoffeeBay Systems Monitoring_",
        ].join("\n");

      case "verification": {
        const code = payload.variables.code;
        const templates = [
          // Variation A
          [
            "*CoffeeBay*",
            "",
            "Your verification code is:",
            `*\`   ${code}   \`*`,
            "",
            "Valid for 5 minutes. Do not share this code.",
          ].join("\n"),
          
          // Variation B
          [
            "*CoffeeBay*",
            "",
            "Use the following code to continue with your verification:",
            `*\`   ${code}   \`*`,
            "",
            "This code is valid for 5 minutes.",
          ].join("\n"),
          
          // Variation C
          [
            "*CoffeeBay Verification*",
            "",
            "Your OTP verification code is:",
            `*\`   ${code}   \`*`,
            "",
            "Please enter this code on the verification screen.",
            "Valid for 5 minutes.",
          ].join("\n"),
          
          // Variation D
          [
            "*CoffeeBay*",
            "",
            "Verification Code:",
            `*\`   ${code}   \`*`,
            "",
            "For security reasons, do not share this verification code.",
          ].join("\n"),
        ];
        
        // Pick one randomly
        const templateIndex = Math.floor(Math.random() * templates.length);
        return templates[templateIndex];
      }

      default: {
        const exhaustiveCheck: never = payload.type;
        throw new Error(`Unknown template type: ${exhaustiveCheck}`);
      }
    }
  }
}
