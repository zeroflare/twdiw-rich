// Income Certificate Model - 處理年收入憑證相關的資料庫操作
import { Context } from "hono";
import { IncomeCertificate } from "../types";
import { getDB } from "./database";

export class IncomeCertificateModel {
  // 創建憑證
  static async create(
    c: Context,
    certificate: Omit<IncomeCertificate, "income_certificate_id" | "created_at" | "updated_at">
  ): Promise<IncomeCertificate> {
    const db = getDB(c);
    const certificateId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `INSERT INTO income_certificates (income_certificate_id, user_id, uuid, value, description, type, year, certificate_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        certificateId,
        certificate.user_id,
        certificate.uuid,
        certificate.value,
        certificate.description,
        certificate.type || "ANNUAL_INCOME",
        certificate.year,
        certificate.certificate_type || "0052696330_vc_income__certificate",
        now,
        now
      )
      .run();

    return {
      ...certificate,
      income_certificate_id: certificateId,
      created_at: now,
      updated_at: now,
    };
  }

  // 根據使用者 ID 獲取所有憑證
  static async findByUserId(c: Context, userId: string): Promise<IncomeCertificate[]> {
    const db = getDB(c);
    const result = await db
      .prepare("SELECT * FROM income_certificates WHERE user_id = ? ORDER BY created_at DESC")
      .bind(userId)
      .all<IncomeCertificate>();

    return result.results || [];
  }

  // 根據 ID 刪除憑證
  static async deleteById(c: Context, certificateId: string): Promise<boolean> {
    const db = getDB(c);
    const result = await db
      .prepare("DELETE FROM income_certificates WHERE income_certificate_id = ?")
      .bind(certificateId)
      .run();

    return result.success;
  }
}

