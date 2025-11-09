// Rank Certificate Controller - 處理財富階層憑證相關的請求
import { Context } from "hono";
import { RankCertificateModel } from "../models/RankCertificate";
import { NetWorthService } from "../services/NetWorthService";
import { CertificateService } from "../services/CertificateService";
import { SessionService } from "../services/SessionService";

export class RankCertificateController {
  // 領取財富階層憑證
  static async claim(c: Context): Promise<Response> {
    const session = await SessionService.get(c);
    if (!session?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      // 計算淨資產
      const summary = await NetWorthService.getSummary(c, session.userId);
      const netWorth = summary.netWorth;

      // 判定財富階層
      let rank = "";
      const netWorthNTD = netWorth;

      if (netWorthNTD >= 150000000) {
        rank = "地球OL．財富畢業證書";
      } else if (netWorthNTD >= 30000000) {
        rank = "人生勝利組S級玩家卡";
      } else if (netWorthNTD >= 3000000) {
        rank = "準富豪VIP登錄證";
      } else if (netWorthNTD >= 300000) {
        rank = "尊爵不凡．小資族認證";
      } else {
        rank = "新手村榮譽村民證";
      }

      // 保存到資料庫
      await RankCertificateModel.create(c, {
        user_id: session.userId,
        rank,
        net_worth: netWorth,
        certificate_type: "0052696330_vc_asset_player_rank_certificate",
      });

      return c.json({
        success: true,
        rank,
        netWorth,
        certificateType: "0052696330_vc_asset_player_rank_certificate",
      });
    } catch (error: any) {
      console.error("Error claiming rank certificate:", error);
      return c.json({ error: error.message || "Failed to claim rank certificate" }, 500);
    }
  }

  // 獲取使用者的財富階層憑證
  static async get(c: Context): Promise<Response> {
    const session = await SessionService.get(c);
    if (!session?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      const certificate = await RankCertificateModel.findByUserId(c, session.userId);

      if (!certificate) {
        return c.json({ exists: false });
      }

      return c.json({
        exists: true,
        certificate,
      });
    } catch (error: any) {
      console.error("Error fetching rank certificate:", error);
      return c.json({ error: error.message || "Failed to fetch rank certificate" }, 500);
    }
  }

  // 生成財富階層憑證發行 QR Code
  static async generateIssuerQRCode(c: Context): Promise<Response> {
    const session = await SessionService.get(c);
    if (!session?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      const body = await c.req.json();
      const { rank, issuanceDate, expiredDate } = body;

      if (!rank) {
        return c.json({ error: "Rank is required" }, 400);
      }

      const result = await CertificateService.generateIssuerQRCode(
        c,
        "0052696330_vc_asset_player_rank_certificate",
        [{ ename: "rank", content: rank }],
        issuanceDate,
        expiredDate
      );

      return c.json(result);
    } catch (error: any) {
      console.error("Error generating issuer QR code:", error);
      return c.json({ error: error.message || "Failed to generate QR code" }, 500);
    }
  }
}
