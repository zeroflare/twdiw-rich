// User Controller - 處理使用者相關的請求
import { Context } from "hono";
import { SessionService } from "../services/SessionService";
import { UserSettingsModel } from "../models/UserSettings";

export class UserController {
  // 獲取當前使用者資訊（包含設定）
  static async getCurrentUser(c: Context): Promise<Response> {
    const session = await SessionService.get(c);
    if (!session?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // 獲取使用者設定（只返回是否有設定，不返回完整的 key）
    const settings = await UserSettingsModel.findByUserId(c, session.userId);
    const hasGeminiApiKey = !!(settings?.gemini_api_key && settings.gemini_api_key.length > 0);

    return c.json({
      userId: session.userId,
      email: session.email,
      name: session.name,
      settings: {
        has_gemini_api_key: hasGeminiApiKey,
      },
    });
  }

  // 更新使用者設定
  static async updateSettings(c: Context): Promise<Response> {
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
      const hasGeminiApiKey = !!(settings.gemini_api_key && settings.gemini_api_key.length > 0);
      return c.json({
        success: true,
        settings: {
          has_gemini_api_key: hasGeminiApiKey,
        },
      });
    } catch (error) {
      console.error("Error updating user settings:", error);
      return c.json({ error: "Failed to update settings" }, 500);
    }
  }
}
