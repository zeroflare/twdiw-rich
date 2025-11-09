import { Context } from "hono";
import { AppBindings } from "../types";
import { GeminiService } from "../services/GeminiService";
import { SessionService } from "../services/SessionService";
import { UserSettingsModel } from "../models/UserSettings";

export class AiController {
  public static async analyzeAssetValue(c: Context<{ Bindings: AppBindings }>) {
    const session = await SessionService.get(c);
    if (!session?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // 從資料庫獲取使用者的 Gemini API Key
    const apiKey = await UserSettingsModel.getGeminiApiKey(c, session.userId);

    if (!apiKey) {
      return c.json({ error: "Gemini API Key 未設定。請前往設定頁面設定您的 API Key。" }, 400);
    }

    const geminiService = new GeminiService(apiKey);
    const { assetName, assetType, assetDetails } = await c.req.json();

    if (!assetName || !assetType) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    // Since the frontend now sends the whole asset object,
    // we extract the metadata from it here.
    const metadata = assetDetails.metadata || assetDetails;

    try {
      const estimatedValue = await geminiService.getAssetValuation(
        assetName,
        assetType,
        metadata,
      );
      return c.json({ estimatedValue });
    } catch (error) {
      console.error(error);
      return c.json({ error: "Failed to analyze asset value" }, 500);
    }
  }
}
