// UserSettings Model - 處理使用者設定相關的資料庫操作
import { Context } from "hono";
import { getDB } from "./database";

export interface UserSettings {
  user_id: string;
  gemini_api_key: string | null;
  created_at?: number;
  updated_at?: number;
}

export class UserSettingsModel {
  // 獲取使用者設定
  static async findByUserId(c: Context, userId: string): Promise<UserSettings | null> {
    const db = getDB(c);
    const result = await db
      .prepare("SELECT * FROM user_settings WHERE user_id = ?")
      .bind(userId)
      .first<UserSettings>();

    return result || null;
  }

  // 更新或創建使用者設定
  static async upsert(c: Context, userId: string, geminiApiKey: string | null): Promise<UserSettings> {
    const db = getDB(c);
    const now = Math.floor(Date.now() / 1000);

    // 先檢查是否存在
    const existing = await this.findByUserId(c, userId);

    if (existing) {
      // 更新現有設定
      const result = await db
        .prepare("UPDATE user_settings SET gemini_api_key = ?, updated_at = ? WHERE user_id = ?")
        .bind(geminiApiKey, now, userId)
        .run();

      if (!result.success) {
        throw new Error("Failed to update user settings");
      }

      return {
        user_id: userId,
        gemini_api_key: geminiApiKey,
        created_at: existing.created_at,
        updated_at: now,
      };
    } else {
      // 創建新設定
      const result = await db
        .prepare("INSERT INTO user_settings (user_id, gemini_api_key, created_at, updated_at) VALUES (?, ?, ?, ?)")
        .bind(userId, geminiApiKey, now, now)
        .run();

      if (!result.success) {
        throw new Error("Failed to create user settings");
      }

      return {
        user_id: userId,
        gemini_api_key: geminiApiKey,
        created_at: now,
        updated_at: now,
      };
    }
  }

  // 獲取使用者的 Gemini API Key
  static async getGeminiApiKey(c: Context, userId: string): Promise<string | null> {
    const settings = await this.findByUserId(c, userId);
    return settings?.gemini_api_key || null;
  }
}

