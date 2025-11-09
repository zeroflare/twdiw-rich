// Asset Model - 處理資產相關的資料庫操作
import { Context } from "hono";
import { Asset } from "../types";
import { getDB } from "./database";

export class AssetModel {
  // 創建資產
  static async create(
    c: Context,
    asset: Omit<Asset, "asset_id" | "created_at" | "updated_at">
  ): Promise<Asset> {
    const db = getDB(c);
    const assetId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    console.log("AssetModel.create - Attempting to insert asset:", {
      assetId,
      userId: asset.user_id,
      assetType: asset.asset_type,
      assetName: asset.asset_name,
      currentValue: asset.current_value,
    });

    const result = await db
      .prepare(
        `INSERT INTO assets (asset_id, user_id, asset_type, asset_name, current_value, location, size_ping, model_no, model_year, uuid, certificate_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        assetId,
        asset.user_id,
        asset.asset_type,
        asset.asset_name,
        asset.current_value,
        asset.location || null,
        asset.size_ping || null,
        asset.model_no || null,
        asset.model_year || null,
        asset.uuid || null,
        asset.certificate_type || null,
        now,
        now
      )
      .run();

    console.log("AssetModel.create - Database result:", {
      success: result.success,
      meta: result.meta,
    });

    if (!result.success) {
      const errorMessage = `Failed to create asset: ${JSON.stringify(result.meta || {})}`;
      console.error("AssetModel.create - Database operation failed:", errorMessage);
      throw new Error(errorMessage);
    }

    const createdAsset = {
      ...asset,
      asset_id: assetId,
      created_at: now,
      updated_at: now,
    };

    console.log("AssetModel.create - Successfully created asset:", {
      assetId: createdAsset.asset_id,
      userId: createdAsset.user_id,
    });

    return createdAsset;
  }

  // 根據使用者 ID 獲取所有資產
  static async findByUserId(c: Context, userId: string): Promise<Asset[]> {
    const db = getDB(c);
    const result = await db
      .prepare("SELECT * FROM assets WHERE user_id = ? ORDER BY created_at DESC")
      .bind(userId)
      .all<Asset>();

    return result.results || [];
  }

  // 刪除資產
  static async delete(c: Context, assetId: string, userId: string): Promise<boolean> {
    const db = getDB(c);
    const result = await db
      .prepare("DELETE FROM assets WHERE asset_id = ? AND user_id = ?")
      .bind(assetId, userId)
      .run();

    return result.success;
  }

  // 計算使用者總資產
  static async getTotalByUserId(c: Context, userId: string): Promise<number> {
    const db = getDB(c);
    const result = await db
      .prepare("SELECT COALESCE(SUM(current_value), 0) as total FROM assets WHERE user_id = ?")
      .bind(userId)
      .first<{ total: number }>();

    return result?.total || 0;
  }

  // 根據 UUID 查找資產
  static async findByUuid(c: Context, uuid: string, userId: string): Promise<Asset | null> {
    const db = getDB(c);
    const result = await db
      .prepare("SELECT * FROM assets WHERE uuid = ? AND user_id = ?")
      .bind(uuid, userId)
      .first<Asset>();

    return result || null;
  }

  // 更新資產價值
  static async updateValue(
    c: Context,
    assetId: string,
    userId: string,
    currentValue: number
  ): Promise<boolean> {
    const db = getDB(c);
    const now = Math.floor(Date.now() / 1000);

    const result = await db
      .prepare("UPDATE assets SET current_value = ?, updated_at = ? WHERE asset_id = ? AND user_id = ?")
      .bind(currentValue, now, assetId, userId)
      .run();

    return result.success;
  }
}
