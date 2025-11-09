// Asset Controller - 處理資產相關的請求
import { Context } from "hono";
import { AssetModel } from "../models/Asset";
import { SessionService } from "../services/SessionService";

export class AssetController {
  // 獲取當前使用者的所有資產
  static async getAll(c: Context): Promise<Response> {
    const session = await SessionService.get(c);
    if (!session?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const assets = await AssetModel.findByUserId(c, session.userId);
    return c.json(assets);
  }

  // 刪除資產
  static async delete(c: Context): Promise<Response> {
    const session = await SessionService.get(c);
    if (!session?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const assetId = c.req.param("id");
    if (!assetId) {
      return c.json({ error: "Asset ID is required" }, 400);
    }

    const success = await AssetModel.delete(c, assetId, session.userId);
    if (!success) {
      return c.json({ error: "Failed to delete asset" }, 500);
    }

    return c.json({ success: true });
  }

  // 更新資產價值
  static async update(c: Context): Promise<Response> {
    const session = await SessionService.get(c);
    if (!session?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const assetId = c.req.param("id");
    if (!assetId) {
      return c.json({ error: "Asset ID is required" }, 400);
    }

    const { current_value } = await c.req.json();
    if (typeof current_value !== "number" || current_value < 0) {
      return c.json({ error: "Invalid current_value" }, 400);
    }

    const success = await AssetModel.updateValue(c, assetId, session.userId, current_value);
    if (!success) {
      return c.json({ error: "Failed to update asset value" }, 500);
    }

    return c.json({ success: true });
  }
}
