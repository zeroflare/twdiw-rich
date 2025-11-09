// Liability Model - 處理負債相關的資料庫操作
import { Context } from "hono";
import { Liability } from "../types";
import { getDB } from "./database";

export class LiabilityModel {
  // 創建負債
  static async create(
    c: Context,
    liability: Omit<Liability, "liability_id" | "created_at" | "updated_at">
  ): Promise<Liability> {
    const db = getDB(c);
    const liabilityId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `INSERT INTO liabilities (liability_id, user_id, liability_type, liability_name, remaining_balance, uuid, certificate_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        liabilityId,
        liability.user_id,
        liability.liability_type,
        liability.liability_name,
        liability.remaining_balance,
        liability.uuid || null,
        liability.certificate_type || null,
        now,
        now
      )
      .run();

    return {
      ...liability,
      liability_id: liabilityId,
      created_at: now,
      updated_at: now,
    };
  }

  // 根據使用者 ID 獲取所有負債
  static async findByUserId(c: Context, userId: string): Promise<Liability[]> {
    const db = getDB(c);
    const result = await db
      .prepare("SELECT * FROM liabilities WHERE user_id = ? ORDER BY created_at DESC")
      .bind(userId)
      .all<Liability>();

    return result.results || [];
  }

  // 刪除負債
  static async delete(c: Context, liabilityId: string, userId: string): Promise<boolean> {
    const db = getDB(c);
    const result = await db
      .prepare("DELETE FROM liabilities WHERE liability_id = ? AND user_id = ?")
      .bind(liabilityId, userId)
      .run();

    return result.success;
  }

  // 計算使用者總負債
  static async getTotalByUserId(c: Context, userId: string): Promise<number> {
    const db = getDB(c);
    const result = await db
      .prepare(
        "SELECT COALESCE(SUM(remaining_balance), 0) as total FROM liabilities WHERE user_id = ?"
      )
      .bind(userId)
      .first<{ total: number }>();

    return result?.total || 0;
  }

  // 根據 UUID 查找負債
  static async findByUuid(c: Context, uuid: string, userId: string): Promise<Liability | null> {
    const db = getDB(c);
    const result = await db
      .prepare("SELECT * FROM liabilities WHERE uuid = ? AND user_id = ?")
      .bind(uuid, userId)
      .first<Liability>();

    return result || null;
  }
}
