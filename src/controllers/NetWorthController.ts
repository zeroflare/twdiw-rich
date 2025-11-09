// Net Worth Controller - 處理淨值相關的請求
import { Context } from "hono";
import { NetWorthService } from "../services/NetWorthService";
import { SessionService } from "../services/SessionService";

export class NetWorthController {
  // 獲取淨值摘要
  static async getSummary(c: Context): Promise<Response> {
    const session = await SessionService.get(c);
    if (!session?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const summary = await NetWorthService.getSummary(c, session.userId);
    const prValue = NetWorthService.calculatePRValue(summary.netWorth);

    return c.json({
      ...summary,
      prValue,
    });
  }
}
