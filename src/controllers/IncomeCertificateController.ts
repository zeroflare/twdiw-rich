// Income Certificate Controller - 處理年收入憑證相關的請求
import { Context } from "hono";
import { IncomeCertificateModel } from "../models/IncomeCertificate";
import { SessionService } from "../services/SessionService";

export class IncomeCertificateController {
  // 獲取使用者的所有年收入憑證
  static async getAll(c: Context): Promise<Response> {
    const session = await SessionService.get(c);
    if (!session?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      const certificates = await IncomeCertificateModel.findByUserId(c, session.userId);
      return c.json(certificates);
    } catch (error: any) {
      console.error("Error getting income certificates:", error);
      return c.json({ error: error.message || "Failed to get income certificates" }, 500);
    }
  }

  // 刪除年收入憑證
  static async delete(c: Context): Promise<Response> {
    const session = await SessionService.get(c);
    if (!session?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      const certificateId = c.req.param("id");
      if (!certificateId) {
        return c.json({ error: "Certificate ID is required" }, 400);
      }

      // 驗證憑證屬於當前使用者
      const certificates = await IncomeCertificateModel.findByUserId(c, session.userId);
      const certificate = certificates.find((cert) => cert.income_certificate_id === certificateId);

      if (!certificate) {
        return c.json({ error: "Certificate not found" }, 404);
      }

      const success = await IncomeCertificateModel.deleteById(c, certificateId);
      if (success) {
        return c.json({ success: true });
      } else {
        return c.json({ error: "Failed to delete certificate" }, 500);
      }
    } catch (error: any) {
      console.error("Error deleting income certificate:", error);
      return c.json({ error: error.message || "Failed to delete income certificate" }, 500);
    }
  }
}

