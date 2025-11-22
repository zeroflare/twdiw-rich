// Issued Certificate Model - 處理發行憑證相關的資料庫操作
import { Context } from "hono";
import { IssuedCertificate } from "../types";
import { getDB } from "./database";

export class IssuedCertificateModel {
  // 創建發行憑證記錄
  static async create(
    c: Context,
    certificate: Omit<IssuedCertificate, "issued_certificate_id" | "created_at" | "updated_at">
  ): Promise<IssuedCertificate> {
    const db = getDB(c);
    const certificateId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `INSERT INTO issued_certificates (issued_certificate_id, user_id, transaction_id, cid, vc_uid, issuance_date, expired_date, fields, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        certificateId,
        certificate.user_id,
        certificate.transaction_id,
        certificate.cid,
        certificate.vc_uid,
        certificate.issuance_date || null,
        certificate.expired_date || null,
        certificate.fields,
        certificate.status || "ISSUED",
        now,
        now
      )
      .run();

    return {
      ...certificate,
      issued_certificate_id: certificateId,
      created_at: now,
      updated_at: now,
    };
  }

  // 根據使用者 ID 獲取所有發行憑證
  static async findByUserId(c: Context, userId: string): Promise<IssuedCertificate[]> {
    const db = getDB(c);
    const result = await db
      .prepare("SELECT * FROM issued_certificates WHERE user_id = ? ORDER BY created_at DESC")
      .bind(userId)
      .all<IssuedCertificate>();

    return result.results || [];
  }

  // 根據 CID 獲取憑證
  static async findByCid(c: Context, cid: string): Promise<IssuedCertificate | null> {
    const db = getDB(c);
    const result = await db
      .prepare("SELECT * FROM issued_certificates WHERE cid = ?")
      .bind(cid)
      .first<IssuedCertificate>();

    return result || null;
  }

  // 更新憑證狀態（撤銷）
  static async updateStatus(
    c: Context,
    cid: string,
    status: "ISSUED" | "REVOKED"
  ): Promise<boolean> {
    const db = getDB(c);
    const now = Math.floor(Date.now() / 1000);
    const result = await db
      .prepare("UPDATE issued_certificates SET status = ?, updated_at = ? WHERE cid = ?")
      .bind(status, now, cid)
      .run();

    return result.success;
  }
}

