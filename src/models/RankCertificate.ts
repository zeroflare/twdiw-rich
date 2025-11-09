// Rank Certificate Model - 處理財富階層憑證相關的資料庫操作
import { Context } from "hono";
import { RankCertificate } from "../types";
import { getDB } from "./database";

export class RankCertificateModel {
  // 創建憑證
  static async create(
    c: Context,
    certificate: Omit<RankCertificate, "rank_certificate_id" | "created_at" | "updated_at">
  ): Promise<RankCertificate> {
    const db = getDB(c);
    const certificateId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `INSERT INTO rank_certificates (rank_certificate_id, user_id, rank, net_worth, certificate_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        certificateId,
        certificate.user_id,
        certificate.rank,
        certificate.net_worth,
        certificate.certificate_type || "0052696330_vc_asset_player_rank_certificate",
        now,
        now
      )
      .run();

    return {
      ...certificate,
      rank_certificate_id: certificateId,
      created_at: now,
      updated_at: now,
    };
  }

  // 根據使用者 ID 獲取最新的憑證
  static async findByUserId(c: Context, userId: string): Promise<RankCertificate | null> {
    const db = getDB(c);
    const result = await db
      .prepare("SELECT * FROM rank_certificates WHERE user_id = ? ORDER BY created_at DESC LIMIT 1")
      .bind(userId)
      .first<RankCertificate>();

    return result || null;
  }
}
