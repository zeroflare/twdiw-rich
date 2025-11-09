// Liability Controller - 處理負債相關的請求
import { Context } from "hono";
import { LiabilityModel } from "../models/Liability";
import { SessionService } from "../services/SessionService";

export class LiabilityController {
  // 獲取當前使用者的所有負債
  static async getAll(c: Context): Promise<Response> {
    const session = await SessionService.get(c);
    if (!session?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const liabilities = await LiabilityModel.findByUserId(c, session.userId);
    return c.json(liabilities);
  }

  // 刪除負債
  static async delete(c: Context): Promise<Response> {
    const session = await SessionService.get(c);
    if (!session?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const liabilityId = c.req.param("id");
    if (!liabilityId) {
      return c.json({ error: "Liability ID is required" }, 400);
    }

    const success = await LiabilityModel.delete(c, liabilityId, session.userId);
    if (!success) {
      return c.json({ error: "Failed to delete liability" }, 500);
    }

    return c.json({ success: true });
  }
}
