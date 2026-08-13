import fs from 'fs';
import path from 'path';

export interface CampaignDistribution {
  prizeId: string;
  quantity: number;
}

export interface GeneratedCodeRecord {
  serialCode: string;
  isWinner: boolean;
  prizeId?: string;
}

export interface CampaignResult {
  success: boolean;
  count: number;
  codes: GeneratedCodeRecord[];
  filePath?: string;
  message?: string;
}

export class CodeGeneratorService {
  private readonly letters = 'ACDEFGHJKLMNPRTUVWXY'; // Clean letters (no B, I, O, S, Z)
  private readonly digits = '0123456789';

  /**
   * Generates a single unique serial code matching format LXXX-XXXX (1 letter + 7 digits).
   */
  generateCode(): string {
    const letter = this.letters[Math.floor(Math.random() * this.letters.length)];
    let numStr = '';
    for (let i = 0; i < 7; i++) {
      numStr += this.digits[Math.floor(Math.random() * this.digits.length)];
    }
    return `${letter}${numStr.slice(0, 3)}-${numStr.slice(3)}`;
  }

  /**
   * Generates a batch of unique serial codes. Guaranteed no duplicates.
   */
  generateBatch(count: number): string[] {
    if (count <= 0) {
      throw new Error('Count must be greater than 0');
    }
    const set = new Set<string>();
    while (set.size < count) {
      set.add(this.generateCode());
    }
    return Array.from(set);
  }

  /**
   * Generates a complete campaign database setup: generates all codes (e.g. 5000),
   * randomly distributes prizes among them, and writes/exports to a CSV file.
   */
  async generateCampaignCodes(
    totalCodes: number,
    distributions: CampaignDistribution[],
    csvOutputPath: string
  ): Promise<CampaignResult> {
    try {
      const totalPrizes = distributions.reduce((acc, curr) => acc + curr.quantity, 0);

      if (totalPrizes > totalCodes) {
        return {
          success: false,
          count: 0,
          codes: [],
          message: `Total prizes (${totalPrizes}) cannot exceed total codes (${totalCodes})`,
        };
      }

      // 1. Generate unique serial codes
      const serials = this.generateBatch(totalCodes);

      // 2. Prepare prize pool
      const prizePool: string[] = [];
      distributions.forEach((dist) => {
        for (let i = 0; i < dist.quantity; i++) {
          prizePool.push(dist.prizeId);
        }
      });

      // Fill the rest with undefined (losers)
      const emptySlots = totalCodes - prizePool.length;

      // 3. Map codes
      const records: GeneratedCodeRecord[] = [];

      // Assign winners first
      for (let i = 0; i < prizePool.length; i++) {
        records.push({
          serialCode: serials[i],
          isWinner: true,
          prizeId: prizePool[i],
        });
      }

      // Assign losers
      for (let i = 0; i < emptySlots; i++) {
        records.push({
          serialCode: serials[prizePool.length + i],
          isWinner: false,
        });
      }

      // 4. Shuffle elements using Fisher-Yates algorithm to ensure fully random distribution
      for (let i = records.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = records[i];
        records[i] = records[j];
        records[j] = temp;
      }

      // 5. Ensure parent directories exist for CSV export
      const absolutePath = path.resolve(csvOutputPath);
      const dir = path.dirname(absolutePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 6. Write to CSV file
      const csvHeader = 'serialCode,isWinner,prizeId\n';
      const csvLines = records.map(
        (r) => `${r.serialCode},${r.isWinner},${r.prizeId || ''}`
      );
      fs.writeFileSync(absolutePath, csvHeader + csvLines.join('\n'), 'utf8');

      return {
        success: true,
        count: records.length,
        codes: records,
        filePath: absolutePath,
        message: `Campaign generated successfully. Total: ${records.length} codes, Winners: ${totalPrizes}, Losers: ${emptySlots}`,
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        count: 0,
        codes: [],
        message: `Failed to generate campaign: ${errMsg}`,
      };
    }
  }
}

export const codeGeneratorService = new CodeGeneratorService();
