// UserSettings Controller - 處理使用者設定相關的請求
import { Context } from "hono";
import { SessionService } from "../services/SessionService";
import { UserSettingsModel } from "../models/UserSettings";

export class UserSettingsController {
  // 獲取當前使用者的設定
  static async get(c: Context): Promise<Response> {
    const session = await SessionService.get(c);
    if (!session?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const settings = await UserSettingsModel.findByUserId(c, session.userId);
    
    // 如果沒有設定，返回空物件
    return c.json({
      gemini_api_key: settings?.gemini_api_key || null,
    });
  }

  // 更新使用者設定
  static async update(c: Context): Promise<Response> {
    const session = await SessionService.get(c);
    if (!session?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { gemini_api_key } = await c.req.json();

    // 驗證 gemini_api_key 是否為字串或 null
    if (gemini_api_key !== null && typeof gemini_api_key !== "string") {
      return c.json({ error: "Invalid gemini_api_key format" }, 400);
    }

    try {
      const settings = await UserSettingsModel.upsert(c, session.userId, gemini_api_key || null);
      return c.json({
        success: true,
        gemini_api_key: settings.gemini_api_key,
      });
    } catch (error) {
      console.error("Error updating user settings:", error);
      return c.json({ error: "Failed to update settings" }, 500);
    }
  }
}

